import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'Type More',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    cleartext: true, 
    url: 'http://localhost',
    hostname:'0.0.0.0'
  },

};

export default config;
