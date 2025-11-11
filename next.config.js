const path = require('path');
const dotenv = require('dotenv');

const envFileByNodeEnv = {
  production: '.env.prod',
  development: '.env.dev',
  test: '.env.test'
};

const envFile = envFileByNodeEnv[process.env.NODE_ENV] || '.env.dev';
dotenv.config({ path: path.resolve(__dirname, envFile), override: true });

const clientEnv = {};
Object.keys(process.env)
  .filter((key) => key.startsWith('VITE_'))
  .forEach((key) => {
    clientEnv[key] = process.env[key];
  });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: clientEnv
};

module.exports = nextConfig;
