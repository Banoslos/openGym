package ch.duartesantos.opengym;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The workout in progress as an ongoing notification, so it shows on the lock screen and in
 * the notification shade while the phone is locked. The clock is a native chronometer: it
 * keeps counting (the elapsed workout, or the rest countdown) even when the WebView is asleep.
 *
 * On Android 16 (Samsung One UI 8) the notification also asks to be promoted to a Live Update,
 * which is what puts it in the lock-screen Now Bar next to music and the Clock app's timers.
 * The request is a plain extra so it compiles against SDK 35; older systems ignore it.
 */
@CapacitorPlugin(name = "LiveWorkout")
public class LiveWorkoutPlugin extends Plugin {
    private static final String CHANNEL = "workout_live";
    private static final int ID = 4242;
    private static final String EXTRA_PROMOTED = "android.requestPromotedOngoing";

    private NotificationManager nm() {
        return (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (nm().getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Workout in progress", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Rest timer and current exercise while you train");
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setShowBadge(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm().createNotificationChannel(ch);
    }

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        ensureChannel();
        String title = call.getString("title", "OpenGym");
        String text = call.getString("text", "");
        Double whenD = call.getDouble("when");
        long when = whenD != null ? whenD.longValue() : System.currentTimeMillis();
        boolean countdown = Boolean.TRUE.equals(call.getBoolean("countdown", false));

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(ctx, CHANNEL)
            : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_stat_workout)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(pi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setWhen(when)
            .setUsesChronometer(true)
            .setCategory(countdown ? Notification.CATEGORY_STOPWATCH : Notification.CATEGORY_WORKOUT)
            .setVisibility(Notification.VISIBILITY_PUBLIC);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) b.setChronometerCountDown(countdown);
        Bundle extras = new Bundle();
        extras.putBoolean(EXTRA_PROMOTED, true);
        b.addExtras(extras);
        try {
            nm().notify(ID, b.build());
            call.resolve();
        } catch (SecurityException e) {
            call.reject("Notifications not allowed");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        nm().cancel(ID);
        call.resolve();
    }
}
