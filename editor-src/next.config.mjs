/** Static export: the editor is plain files served by PHP (no Node.js on the server).
 *  It lives under /admin and talks to the PHP API at /api/index.php. */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: "/admin",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
