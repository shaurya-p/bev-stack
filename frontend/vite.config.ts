import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep a single copy of three when mixing direct three/examples imports
  // with @react-three/drei's three-stdlib.
  resolve: {
    dedupe: ['three'],
  },
});
