package mx.fina.app;

import android.content.Intent;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.IsoDep;
import android.os.Bundle;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * "Acerca tu tarjeta": lee por NFC la marca, los últimos 4 dígitos y el
 * vencimiento de una tarjeta sin contacto para darla de alta.
 * El número completo nunca llega a la app web (ver EmvReader).
 */
@CapacitorPlugin(name = "CardNfc")
public class CardNfcPlugin extends Plugin {

    private PluginCall pending;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        JSObject r = new JSObject();
        r.put("available", adapter != null);
        r.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(r);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NFC_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void scan(PluginCall call) {
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        if (adapter == null) {
            call.reject("Este teléfono no tiene NFC.", "NFC_UNAVAILABLE");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Activa el NFC en los ajustes del teléfono.", "NFC_DISABLED");
            return;
        }
        if (pending != null) pending.reject("Se canceló la lectura anterior.", "CANCELLED");
        pending = call;
        Bundle extras = new Bundle();
        extras.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250);
        getActivity()
            .runOnUiThread(() ->
                adapter.enableReaderMode(
                    getActivity(),
                    this::onTag,
                    NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
                    extras
                )
            );
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        stopReader();
        if (pending != null) {
            pending.reject("Lectura cancelada.", "CANCELLED");
            pending = null;
        }
        call.resolve();
    }

    private void onTag(Tag tag) {
        PluginCall call = pending;
        if (call == null) return;
        IsoDep iso = IsoDep.get(tag);
        if (iso == null) {
            finish(call, null, "No parece una tarjeta bancaria. Intenta de nuevo.", "NOT_A_CARD");
            return;
        }
        try {
            iso.connect();
            iso.setTimeout(5000);
            EmvReader.Result r = new EmvReader(iso::transceive).read();
            JSObject out = new JSObject();
            out.put("brand", r.brand);
            out.put("last4", r.last4);
            if (r.expiry != null) out.put("expiry", r.expiry);
            if (r.label != null) out.put("label", r.label);
            if (r.kind != null) out.put("kind", r.kind);
            finish(call, out, null, null);
        } catch (EmvReader.CardReadException e) {
            finish(call, null, "No pude leer los datos de esta tarjeta. Agrégala a mano.", "NO_CARD_DATA");
        } catch (Exception e) {
            finish(call, null, "Se movió la tarjeta. Déjala quieta y vuelve a intentar.", "READ_FAILED");
        } finally {
            try {
                iso.close();
            } catch (Exception ignored) {
                // nada
            }
        }
    }

    private void finish(PluginCall call, JSObject result, String error, String code) {
        stopReader();
        pending = null;
        if (result != null) call.resolve(result);
        else call.reject(error, code);
    }

    private void stopReader() {
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        if (adapter == null || getActivity() == null) return;
        getActivity()
            .runOnUiThread(() -> {
                try {
                    adapter.disableReaderMode(getActivity());
                } catch (Exception ignored) {
                    // la actividad ya no está en primer plano
                }
            });
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (pending != null) {
            stopReader();
            pending.reject("Lectura cancelada.", "CANCELLED");
            pending = null;
        }
    }
}
