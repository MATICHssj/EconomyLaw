package mx.fina.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

/** Puente JS ↔ Android para el lector de notificaciones bancarias. */
@CapacitorPlugin(name = "BankNotifications")
public class BankNotificationsPlugin extends Plugin {
    private static BankNotificationsPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    static void emit(JSONObject item) {
        if (instance == null) return;
        try {
            instance.notifyListeners("bankNotification", JSObject.fromJSONObject(item));
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        Context ctx = getContext();
        boolean enabled = NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.getPackageName());
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void setAllowedApps(PluginCall call) {
        try {
            JSArray arr = call.getArray("packages", new JSArray());
            Set<String> set = new HashSet<>();
            for (int i = 0; i < arr.length(); i++) set.add(arr.getString(i));
            getContext().getSharedPreferences(BankNotificationListener.PREFS, Context.MODE_PRIVATE).edit().putStringSet(BankNotificationListener.KEY_ALLOWED, set).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo guardar la lista", e);
        }
    }

    @PluginMethod
    public void getAllowedApps(PluginCall call) {
        JSArray arr = new JSArray();
        for (String p : BankNotificationListener.allowed(getContext())) arr.put(p);
        JSObject ret = new JSObject();
        ret.put("packages", arr);
        call.resolve(ret);
    }

    /** Devuelve y vacía la cola de notificaciones capturadas. */
    @PluginMethod
    public void takePending(PluginCall call) {
        synchronized (BankNotificationListener.class) {
            SharedPreferences prefs = getContext().getSharedPreferences(BankNotificationListener.PREFS, Context.MODE_PRIVATE);
            try {
                JSONArray queue = new JSONArray(prefs.getString(BankNotificationListener.KEY_QUEUE, "[]"));
                prefs.edit().putString(BankNotificationListener.KEY_QUEUE, "[]").apply();
                JSObject ret = new JSObject();
                ret.put("items", JSArray.from(toList(queue)));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Cola inválida", e);
            }
        }
    }

    private static java.util.List<Object> toList(JSONArray a) throws org.json.JSONException {
        java.util.List<Object> out = new java.util.ArrayList<>();
        for (int i = 0; i < a.length(); i++) out.add(a.getJSONObject(i));
        return out;
    }
}
