package mx.fina.app;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.List;

/**
 * Lee los datos VISIBLES de una tarjeta bancaria sin contacto (EMV) para darla
 * de alta en Fina: marca, últimos 4 dígitos y vencimiento.
 *
 * Seguridad:
 * - Solo se leen datos públicos que la tarjeta entrega a cualquier terminal; no
 *   se pide PIN ni se hace ningún cobro (el monto de la consulta es $0).
 * - El número completo NUNCA sale de esta clase: se usa en memoria para sacar
 *   los últimos 4 dígitos y se borra de inmediato. No se guarda ni se registra.
 * - No se lee el nombre del titular ni el CVV (el CVV no viaja por NFC).
 */
public final class EmvReader {

    /** Envía un comando APDU a la tarjeta y regresa la respuesta (con SW1 SW2 al final). */
    public interface Transceiver {
        byte[] transceive(byte[] apdu) throws IOException;
    }

    public static final class Result {
        public final String brand; // visa | mastercard | amex | carnet | other
        public final String last4; // "1234"
        public final String expiry; // "YYYY-MM" o null
        public final String label; // Etiqueta de la app de la tarjeta (p. ej. "VISA DEBITO") o null
        public final String kind; // "credit" | "debit" | null

        Result(String brand, String last4, String expiry, String label, String kind) {
            this.brand = brand;
            this.last4 = last4;
            this.expiry = expiry;
            this.label = label;
            this.kind = kind;
        }
    }

    public static final class CardReadException extends Exception {
        public CardReadException(String message) {
            super(message);
        }
    }

    private static final byte[] PPSE = "2PAY.SYS.DDF01".getBytes(StandardCharsets.US_ASCII);

    /** AIDs conocidos por si la tarjeta no responde al directorio PPSE. */
    private static final String[] KNOWN_AIDS = {
        "A0000000031010", // Visa crédito/débito
        "A0000000032010", // Visa Electron
        "A0000000041010", // Mastercard
        "A0000000043060", // Maestro
        "A00000002501", // American Express
        "A0000001524010", // Carnet
    };

    private final Transceiver io;
    private final SecureRandom random = new SecureRandom();

    public EmvReader(Transceiver io) {
        this.io = io;
    }

    public Result read() throws IOException, CardReadException {
        List<byte[]> aids = new ArrayList<>();
        byte[] ppse = command(selectApdu(PPSE));
        if (ppse != null) {
            for (Tlv t : Tlv.parseAll(ppse)) collect(t, 0x4F, aids);
        }
        if (aids.isEmpty()) for (String a : KNOWN_AIDS) aids.add(hex(a));

        for (byte[] aid : aids) {
            byte[] fci = command(selectApdu(aid));
            if (fci == null) continue;
            List<Tlv> fciTlv = Tlv.parseAll(fci);
            String label = ascii(find(fciTlv, 0x9F12));
            if (label == null) label = ascii(find(fciTlv, 0x50));
            byte[] pdol = find(fciTlv, 0x9F38);

            CardData data = new CardData();
            byte[] gpo = command(gpoApdu(pdol));
            if (gpo != null) {
                List<Tlv> gpoTlv = Tlv.parseAll(gpo);
                data.absorb(gpoTlv);
                if (!data.complete()) {
                    byte[] afl = aflFrom(gpoTlv);
                    readRecords(afl, data);
                }
            }
            if (!data.complete()) readRecords(null, data);
            try {
                if (data.pan == null) continue;
                String last4 = new String(data.pan, data.pan.length - 4, 4);
                String brand = brandFor(aid, data.pan);
                String kind = kindFor(label);
                return new Result(brand, last4, data.expiry, clean(label), kind);
            } finally {
                data.wipe();
            }
        }
        throw new CardReadException("NO_CARD_DATA");
    }

    // ——————————————————— Lectura ———————————————————

    private void readRecords(byte[] afl, CardData data) throws IOException {
        if (afl != null && afl.length >= 4) {
            for (int i = 0; i + 3 < afl.length && !data.complete(); i += 4) {
                int sfi = (afl[i] & 0xFF) >> 3;
                int first = afl[i + 1] & 0xFF;
                int last = afl[i + 2] & 0xFF;
                for (int r = first; r <= last && r <= 16 && !data.complete(); r++) {
                    byte[] rec = command(readRecordApdu(sfi, r));
                    if (rec != null) data.absorb(Tlv.parseAll(rec));
                }
            }
            return;
        }
        // Sin AFL: se prueban los primeros registros de los primeros archivos.
        for (int sfi = 1; sfi <= 4 && !data.complete(); sfi++) {
            for (int r = 1; r <= 4 && !data.complete(); r++) {
                byte[] rec = command(readRecordApdu(sfi, r));
                if (rec != null) data.absorb(Tlv.parseAll(rec));
            }
        }
    }

    /** Envía y regresa los datos si la respuesta fue 90 00; null si no. */
    private byte[] command(byte[] apdu) throws IOException {
        byte[] r = io.transceive(apdu);
        if (r == null || r.length < 2) return null;
        int sw1 = r[r.length - 2] & 0xFF;
        int sw2 = r[r.length - 1] & 0xFF;
        if (sw1 == 0x6C) { // Longitud incorrecta: se repite con la correcta.
            byte[] again = Arrays.copyOf(apdu, apdu.length);
            again[again.length - 1] = (byte) sw2;
            r = io.transceive(again);
            if (r == null || r.length < 2) return null;
            sw1 = r[r.length - 2] & 0xFF;
            sw2 = r[r.length - 1] & 0xFF;
        }
        if (sw1 == 0x61) { // Hay más datos: GET RESPONSE.
            r = io.transceive(new byte[] {0x00, (byte) 0xC0, 0x00, 0x00, (byte) sw2});
            if (r == null || r.length < 2) return null;
            sw1 = r[r.length - 2] & 0xFF;
            sw2 = r[r.length - 1] & 0xFF;
        }
        if (sw1 != 0x90 || sw2 != 0x00) return null;
        return Arrays.copyOf(r, r.length - 2);
    }

    static byte[] selectApdu(byte[] name) {
        byte[] a = new byte[6 + name.length];
        a[0] = 0x00;
        a[1] = (byte) 0xA4;
        a[2] = 0x04;
        a[3] = 0x00;
        a[4] = (byte) name.length;
        System.arraycopy(name, 0, a, 5, name.length);
        a[a.length - 1] = 0x00;
        return a;
    }

    static byte[] readRecordApdu(int sfi, int record) {
        return new byte[] {0x00, (byte) 0xB2, (byte) record, (byte) ((sfi << 3) | 4), 0x00};
    }

    /** GET PROCESSING OPTIONS con los datos que pida la tarjeta (PDOL), monto $0 y México. */
    byte[] gpoApdu(byte[] pdol) {
        byte[] data = pdol == null ? new byte[0] : pdolData(pdol);
        byte[] a = new byte[data.length + 8];
        a[0] = (byte) 0x80;
        a[1] = (byte) 0xA8;
        a[2] = 0x00;
        a[3] = 0x00;
        a[4] = (byte) (data.length + 2);
        a[5] = (byte) 0x83;
        a[6] = (byte) data.length;
        System.arraycopy(data, 0, a, 7, data.length);
        a[a.length - 1] = 0x00;
        return a;
    }

    private byte[] pdolData(byte[] pdol) {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        int i = 0;
        while (i < pdol.length) {
            int tag = pdol[i++] & 0xFF;
            if ((tag & 0x1F) == 0x1F) {
                while (i < pdol.length) {
                    int b = pdol[i++] & 0xFF;
                    tag = (tag << 8) | b;
                    if ((b & 0x80) == 0) break;
                }
            }
            if (i >= pdol.length) break;
            int len = pdol[i++] & 0xFF;
            byte[] value = terminalValue(tag, len);
            out.write(value, 0, value.length);
        }
        return out.toByteArray();
    }

    private byte[] terminalValue(int tag, int len) {
        byte[] v = new byte[len];
        Calendar c = Calendar.getInstance();
        switch (tag) {
            case 0x9F66: // Capacidades de la terminal (lectura sin contacto, sin cobro)
                put(v, new byte[] {(byte) 0xF6, 0x20, (byte) 0xC0, 0x00});
                break;
            case 0x9F1A: // País: México
            case 0x5F2A: // Moneda: MXN
                put(v, new byte[] {0x04, (byte) 0x84});
                break;
            case 0x9A: // Fecha AAMMDD (BCD)
                put(v, new byte[] {bcd(c.get(Calendar.YEAR) % 100), bcd(c.get(Calendar.MONTH) + 1), bcd(c.get(Calendar.DAY_OF_MONTH))});
                break;
            case 0x9F37: // Número impredecible
                random.nextBytes(v);
                break;
            case 0x9F35: // Tipo de terminal
                put(v, new byte[] {0x22});
                break;
            default: // Monto $0 y el resto en ceros
                break;
        }
        return v;
    }

    private static void put(byte[] target, byte[] src) {
        System.arraycopy(src, 0, target, 0, Math.min(target.length, src.length));
    }

    private static byte bcd(int n) {
        return (byte) (((n / 10) << 4) | (n % 10));
    }

    private static byte[] aflFrom(List<Tlv> tlvs) {
        byte[] afl = find(tlvs, 0x94);
        if (afl != null) return afl;
        byte[] fmt1 = find(tlvs, 0x80); // Formato 1: AIP (2 bytes) + AFL
        if (fmt1 != null && fmt1.length > 2) return Arrays.copyOfRange(fmt1, 2, fmt1.length);
        return null;
    }

    // ——————————————————— Datos de la tarjeta ———————————————————

    /** Acumula PAN y vencimiento; el PAN se guarda como dígitos y se borra al final. */
    static final class CardData {
        char[] pan;
        String expiry;

        boolean complete() {
            return pan != null && expiry != null;
        }

        void absorb(List<Tlv> tlvs) {
            for (Tlv t : tlvs) absorb(t);
        }

        private void absorb(Tlv t) {
            if (t.children != null) {
                for (Tlv c : t.children) absorb(c);
                return;
            }
            if (t.tag == 0x5A) {
                if (pan == null) pan = bcdDigits(t.value);
                Arrays.fill(t.value, (byte) 0);
            } else if (t.tag == 0x57 || t.tag == 0x9F6B) { // Track 2 equivalente
                char[] digits = bcdDigits(t.value);
                int sep = -1;
                for (int i = 0; i < digits.length; i++) if (digits[i] == 'D') { sep = i; break; }
                if (sep > 0) {
                    if (pan == null) pan = Arrays.copyOf(digits, sep);
                    if (expiry == null && digits.length >= sep + 5)
                        expiry = toExpiry(digits[sep + 1], digits[sep + 2], digits[sep + 3], digits[sep + 4]);
                }
                Arrays.fill(digits, '0');
                Arrays.fill(t.value, (byte) 0);
            } else if (t.tag == 0x5F24 && t.value.length >= 2 && expiry == null) {
                char[] d = bcdDigits(t.value);
                if (d.length >= 4) expiry = toExpiry(d[0], d[1], d[2], d[3]);
            }
        }

        void wipe() {
            if (pan != null) Arrays.fill(pan, '0');
            pan = null;
        }
    }

    static String toExpiry(char y1, char y2, char m1, char m2) {
        if (!Character.isDigit(y1) || !Character.isDigit(y2) || !Character.isDigit(m1) || !Character.isDigit(m2)) return null;
        int month = (m1 - '0') * 10 + (m2 - '0');
        if (month < 1 || month > 12) return null;
        return "20" + y1 + y2 + "-" + m1 + m2;
    }

    /** Dígitos BCD (la F de relleno se omite; la D del Track 2 se conserva como separador). */
    static char[] bcdDigits(byte[] value) {
        char[] out = new char[value.length * 2];
        int n = 0;
        for (byte b : value) {
            for (int nib : new int[] {(b >> 4) & 0x0F, b & 0x0F}) {
                if (nib <= 9) out[n++] = (char) ('0' + nib);
                else if (nib == 0x0D) out[n++] = 'D';
            }
        }
        char[] res = Arrays.copyOf(out, n);
        Arrays.fill(out, '0');
        return res;
    }

    static String brandFor(byte[] aid, char[] pan) {
        String a = hexString(aid);
        if (a.startsWith("A000000003")) return "visa";
        if (a.startsWith("A000000004")) return "mastercard";
        if (a.startsWith("A000000025")) return "amex";
        if (a.startsWith("A000000152")) return "carnet";
        if (pan != null && pan.length > 1) {
            if (pan[0] == '4') return "visa";
            if (pan[0] == '5' || pan[0] == '2') return "mastercard";
            if (pan[0] == '3' && (pan[1] == '4' || pan[1] == '7')) return "amex";
        }
        return "other";
    }

    static String kindFor(String label) {
        if (label == null) return null;
        String l = label.toUpperCase();
        if (l.contains("DEBIT") || l.contains("DÉBIT") || l.contains("ELECTRON") || l.contains("MAESTRO")) return "debit";
        if (l.contains("CREDIT") || l.contains("CRÉDIT")) return "credit";
        return null;
    }

    // ——————————————————— TLV ———————————————————

    static final class Tlv {
        final int tag;
        final byte[] value;
        final List<Tlv> children;

        Tlv(int tag, byte[] value, List<Tlv> children) {
            this.tag = tag;
            this.value = value;
            this.children = children;
        }

        static List<Tlv> parseAll(byte[] data) {
            List<Tlv> out = new ArrayList<>();
            parse(data, 0, data.length, out, 0);
            return out;
        }

        private static void parse(byte[] d, int start, int end, List<Tlv> out, int depth) {
            int i = start;
            while (i < end) {
                int first = d[i] & 0xFF;
                if (first == 0x00 || first == 0xFF) { i++; continue; } // relleno
                boolean constructed = (first & 0x20) != 0;
                int tag = first;
                i++;
                if ((first & 0x1F) == 0x1F) {
                    while (i < end) {
                        int b = d[i++] & 0xFF;
                        tag = (tag << 8) | b;
                        if ((b & 0x80) == 0) break;
                    }
                }
                if (i >= end) return;
                int len = d[i++] & 0xFF;
                if (len == 0x81) {
                    if (i >= end) return;
                    len = d[i++] & 0xFF;
                } else if (len == 0x82) {
                    if (i + 1 >= end) return;
                    len = ((d[i] & 0xFF) << 8) | (d[i + 1] & 0xFF);
                    i += 2;
                } else if (len > 0x82) {
                    return;
                }
                if (i + len > end) return;
                byte[] value = Arrays.copyOfRange(d, i, i + len);
                List<Tlv> children = null;
                if (constructed && depth < 8) {
                    children = new ArrayList<>();
                    parse(d, i, i + len, children, depth + 1);
                }
                out.add(new Tlv(tag, value, children));
                i += len;
            }
        }
    }

    private static void collect(Tlv t, int tag, List<byte[]> out) {
        if (t.tag == tag) out.add(t.value);
        if (t.children != null) for (Tlv c : t.children) collect(c, tag, out);
    }

    static byte[] find(List<Tlv> tlvs, int tag) {
        for (Tlv t : tlvs) {
            if (t.tag == tag) return t.value;
            if (t.children != null) {
                byte[] v = find(t.children, tag);
                if (v != null) return v;
            }
        }
        return null;
    }

    private static String ascii(byte[] v) {
        if (v == null) return null;
        StringBuilder sb = new StringBuilder();
        for (byte b : v) {
            int c = b & 0xFF;
            if (c >= 0x20 && c < 0x7F) sb.append((char) c);
        }
        String s = sb.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static String clean(String label) {
        if (label == null) return null;
        String s = label.replaceAll("[^A-Za-z0-9 .\\-]", "").trim();
        return s.length() > 40 ? s.substring(0, 40) : s;
    }

    static byte[] hex(String s) {
        byte[] out = new byte[s.length() / 2];
        for (int i = 0; i < out.length; i++)
            out[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return out;
    }

    static String hexString(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02X", x & 0xFF));
        return sb.toString();
    }
}
