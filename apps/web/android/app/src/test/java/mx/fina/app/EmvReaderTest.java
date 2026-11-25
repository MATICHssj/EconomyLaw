package mx.fina.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.Test;

/** Tarjetas simuladas con números de PRUEBA (no son tarjetas reales). */
public class EmvReaderTest {

    // ——— Utilidades para armar respuestas TLV ———

    private static byte[] tlv(int tag, byte[]... parts) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        for (byte[] p : parts) body.write(p, 0, p.length);
        byte[] v = body.toByteArray();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (tag > 0xFF) out.write((tag >> 8) & 0xFF);
        out.write(tag & 0xFF);
        if (v.length > 0x7F) {
            out.write(0x81);
        }
        out.write(v.length);
        out.write(v, 0, v.length);
        return out.toByteArray();
    }

    private static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.US_ASCII);
    }

    /** "4111...D2812..." → bytes (con F de relleno si es impar). */
    private static byte[] nibbles(String s) {
        if (s.length() % 2 == 1) s = s + "F";
        byte[] out = new byte[s.length() / 2];
        for (int i = 0; i < out.length; i++)
            out[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return out;
    }

    private static byte[] ok(byte[] data) {
        byte[] r = new byte[data.length + 2];
        System.arraycopy(data, 0, r, 0, data.length);
        r[r.length - 2] = (byte) 0x90;
        r[r.length - 1] = 0x00;
        return r;
    }

    private static final byte[] NOT_FOUND = {0x6A, (byte) 0x82};

    /** Tarjeta falsa: responde según el inicio del comando (hex). */
    private static final class FakeCard implements EmvReader.Transceiver {
        final Map<String, byte[]> responses = new LinkedHashMap<>();
        final List<String> sent = new ArrayList<>();

        FakeCard on(String apduPrefixHex, byte[] response) {
            responses.put(apduPrefixHex, response);
            return this;
        }

        @Override
        public byte[] transceive(byte[] apdu) {
            String hex = EmvReader.hexString(apdu);
            sent.add(hex);
            for (Map.Entry<String, byte[]> e : responses.entrySet())
                if (hex.startsWith(e.getKey())) return e.getValue();
            return NOT_FOUND;
        }
    }

    private static String selectHex(byte[] name) {
        return EmvReader.hexString(EmvReader.selectApdu(name));
    }

    @Test
    public void visaDebitWithTrack2InRecords() throws Exception {
        byte[] aid = EmvReader.hex("A0000000031010");
        byte[] ppse =
            tlv(0x6F,
                tlv(0x84, ascii("2PAY.SYS.DDF01")),
                tlv(0xA5,
                    tlv(0xBF0C,
                        tlv(0x61, tlv(0x4F, aid), tlv(0x50, ascii("VISA DEBIT")), tlv(0x87, new byte[] {1})))));
        byte[] pdol = EmvReader.hex("9F66049F02069F37045F2A02");
        byte[] fci = tlv(0x6F, tlv(0x84, aid), tlv(0xA5, tlv(0x50, ascii("VISA DEBIT")), tlv(0x9F38, pdol)));
        byte[] gpo = tlv(0x77, tlv(0x82, new byte[] {0x20, 0x00}), tlv(0x94, EmvReader.hex("08010100")));
        byte[] record = tlv(0x70, tlv(0x57, nibbles("4111111111111111D28122010000000000")));

        FakeCard card = new FakeCard()
            .on(selectHex(ascii("2PAY.SYS.DDF01")), ok(ppse))
            .on(selectHex(aid), ok(fci))
            .on("80A80000", ok(gpo))
            .on("00B2010C", ok(record));

        EmvReader.Result r = new EmvReader(card).read();
        assertEquals("visa", r.brand);
        assertEquals("1111", r.last4);
        assertEquals("2028-12", r.expiry);
        assertEquals("VISA DEBIT", r.label);
        assertEquals("debit", r.kind);

        // GPO con los 16 bytes que pidió el PDOL (4 + 6 + 4 + 2): Lc = 18, 83 10.
        String gpoSent = card.sent.stream().filter(s -> s.startsWith("80A8")).findFirst().orElse("");
        assertTrue(gpoSent.startsWith("80A80000128310"));
        // País/moneda México al final del PDOL (5F2A = 0484).
        assertTrue(gpoSent.endsWith("048400"));
    }

    @Test
    public void mastercardWithoutPpseUsesKnownAidsAndPanTag() throws Exception {
        byte[] aid = EmvReader.hex("A0000000041010");
        byte[] fci = tlv(0x6F, tlv(0x84, aid), tlv(0xA5, tlv(0x50, ascii("Mastercard"))));
        // Formato 1: 80 [AIP 2 bytes + AFL]
        byte[] gpo = tlv(0x80, EmvReader.hex("1980" + "10010200"));
        byte[] rec1 = tlv(0x70, tlv(0x5F24, EmvReader.hex("300531")));
        byte[] rec2 = tlv(0x70, tlv(0x5A, nibbles("5555555555554444")));

        FakeCard card = new FakeCard()
            .on(selectHex(aid), ok(fci))
            .on("80A80000", ok(gpo))
            .on("00B20114", ok(rec1))
            .on("00B20214", ok(rec2));

        EmvReader.Result r = new EmvReader(card).read();
        assertEquals("mastercard", r.brand);
        assertEquals("4444", r.last4);
        assertEquals("2030-05", r.expiry);
        assertNull(r.kind);
        // Sin PDOL: GPO con datos vacíos.
        assertTrue(card.sent.contains("80A8000002830000"));
    }

    @Test
    public void notACardThrows() {
        FakeCard nothing = new FakeCard();
        assertThrows(EmvReader.CardReadException.class, () -> new EmvReader(nothing).read());
    }

    @Test
    public void tlvParsesLongLengthsAndMultiByteTags() {
        byte[] big = new byte[200];
        byte[] data = tlv(0x70, tlv(0x9F12, ascii("BANCO")), tlv(0xDF01, big));
        List<EmvReader.Tlv> parsed = EmvReader.Tlv.parseAll(data);
        assertEquals("BANCO", new String(EmvReader.find(parsed, 0x9F12), StandardCharsets.US_ASCII));
        assertEquals(200, EmvReader.find(parsed, 0xDF01).length);
    }

    @Test
    public void expiryAndBrandHelpers() {
        assertEquals("2027-01", EmvReader.toExpiry('2', '7', '0', '1'));
        assertNull(EmvReader.toExpiry('2', '7', '1', '3'));
        assertEquals("amex", EmvReader.brandFor(new byte[] {0x00}, "371449635398431".toCharArray()));
        assertEquals("carnet", EmvReader.brandFor(EmvReader.hex("A0000001524010"), null));
        assertEquals("credit", EmvReader.kindFor("VISA CREDITO"));
    }
}
