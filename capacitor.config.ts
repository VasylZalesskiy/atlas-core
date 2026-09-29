import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.atlas.core",
  appName: "ATLAS",
  webDir: "dist",
  server: {
    url: "https://atlas-core-two.vercel.app",
    cleartext: false,
    allowNavigation: ["atlas-core-two.vercel.app"]
  },
  android: {
    backgroundColor: "#ffffff"
  }
};

export default config;
