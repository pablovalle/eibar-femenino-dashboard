import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({root:'standalone-pages',base:'./',plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname)}},build:{outDir:'../pages-dist',emptyOutDir:true},css:{postcss:path.resolve(import.meta.dirname)}});
