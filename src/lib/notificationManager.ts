import { LocalNotifications } from '@capacitor/local-notifications';

export const notificationManager = {
    requestPermissions: async () => {
        try {
            const result = await LocalNotifications.requestPermissions();
            return result.display === 'granted';
        } catch (error) {
            console.error('Error requesting notification permissions:', error);
            return false;
        }
    },

    scheduleDailyNotification: async (hour: number, minute: number) => {
        try {
            // Cancel existing notifications first to avoid duplicates
            const pending = await LocalNotifications.getPending();
            if (pending.notifications.length > 0) {
                await LocalNotifications.cancel(pending);
            }

            // Schedule new notification
            await LocalNotifications.schedule({
                notifications: [
                    {
                        title: "Mission Time! 🎯",
                        body: "It's time to check your daily mission and grow today!",
                        id: 1,
                        schedule: {
                            on: {
                                hour,
                                minute,
                            },
                            allowWhileIdle: true, // Allow executing even when device is in doze mode
                            repeats: true, // Repeat daily
                        },
                        sound: 'default', // Optional: customize sound
                        attachments: [], // Optional: add images if needed
                        actionTypeId: '',
                        extra: null,
                    },
                ],
            });
            console.log(`Notification scheduled for ${hour}:${minute} daily.`);
            return true;
        } catch (error) {
            console.error('Error scheduling notification:', error);
            return false;
        }
    },

    cancelNotifications: async () => {
        try {
            const pending = await LocalNotifications.getPending();
            if (pending.notifications.length > 0) {
                await LocalNotifications.cancel(pending);
                console.log('All notifications cancelled.');
            }
        } catch (error) {
            console.error('Error cancelling notifications:', error);
        }
    },

    getPendingNotifications: async () => {
        try {
            return await LocalNotifications.getPending();
        } catch (error) {
            console.error('Error fetching pending notifications:', error);
            return { notifications: [] };
        }
    }
};
