package mx.fina.app;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

/**
 * Lee SOLO las notificaciones de las apps bancarias que el usuario eligió en Fina
 * (lista blanca). El texto se guarda localmente en el teléfono y la app lo convierte
 * en movimientos. Nada se envía a ningún servidor desde aquí.
 */
public class BankNotificationListener extends NotificationListenerService {
    static final String PREFS = "fina_bank_notifications";
    static final String KEY_ALLOWED = "allowed_packages";
    static final String KEY_QUEUE = "queue";
    private static final int MAX_QUEUE = 200;

    static Set<String> allowed(Context ctx) {
        return ctx.getSharedPreferences(PREFS, MODE_PRIVATE).getStringSet(KEY_ALLOWED, new HashSet<>());
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            if (!allowed(this).contains(pkg)) return;
            Bundle extras = sbn.getNotification().extras;
            CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            if (text == null) text = extras.getCharSequence(Notification.EXTRA_TEXT);
            if (text == null) return;
            JSONObject item = new JSONObject();
            item.put("id", sbn.getKey() + ":" + sbn.getPostTime());
            item.put("package", pkg);
            item.put("title", title == null ? "" : title.toString());
            item.put("text", text.toString());
            item.put("postedAt", sbn.getPostTime());
            synchronized (BankNotificationListener.class) {
                SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
                JSONArray queue = new JSONArray(prefs.getString(KEY_QUEUE, "[]"));
                // Evita duplicados (las apps a veces actualizan la misma notificación).
                for (int i = 0; i < queue.length(); i++) {
                    if (queue.getJSONObject(i).optString("text").equals(item.getString("text"))) return;
                }
                queue.put(item);
                while (queue.length() > MAX_QUEUE) queue.remove(0);
                prefs.edit().putString(KEY_QUEUE, queue.toString()).apply();
            }
            BankNotificationsPlugin.emit(item);
        } catch (Exception ignored) {
            // Nunca tumbar el servicio por una notificación rara.
        }
    }
}
