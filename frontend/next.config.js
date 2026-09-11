/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;
    if (backendUrl) {
      return [
        { source: '/api/backend/:path*', destination: `${backendUrl}/api/:path*` },
        { source: '/transcribe', destination: `${backendUrl}/transcribe` },
        { source: '/generate-note', destination: `${backendUrl}/generate-note` },
        { source: '/check-interactions', destination: `${backendUrl}/check-interactions` },
        { source: '/export-pdf', destination: `${backendUrl}/export-pdf` },
        { source: '/export-fhir', destination: `${backendUrl}/export-fhir` },
      ];
    }
    return [
      { source: '/transcribe', destination: '/api/transcribe' },
      { source: '/generate-note', destination: '/api/generate-note' },
      { source: '/check-interactions', destination: '/api/medications/check' },
    ];
  },
};

module.exports = nextConfig;
