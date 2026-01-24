-- Add payment_mode key if it doesn't exist
INSERT INTO admin_settings (key, value)
VALUES ('payment_mode', 'test')
ON CONFLICT (key) DO NOTHING;
