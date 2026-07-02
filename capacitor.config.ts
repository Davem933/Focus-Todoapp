import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.donext.app",
  appName: "DoNext",
  webDir: "dist",
  android: {
    backgroundColor: "#060812",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_donext",
      iconColor: "#7C5CFF",
    },
  },
};

export default config;
