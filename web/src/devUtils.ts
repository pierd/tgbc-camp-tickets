export function isLocalHost(host = window.location.hostname) {
  // Check for localhost (name or IPv4) and IPv6 localhost
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return true;
  }

  // Check for private IP ranges commonly used for local development
  // RegExp for 10.x.x.x, 172.16.x.x - 172.31.x.x, and 192.168.x.x ranges
  const privateIpRegex =
    /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})$/;
  return privateIpRegex.test(host);
}

export function isDev() {
  return (
    import.meta.env.MODE === "development" &&
    import.meta.env.VITE_FIREBASE_PRODUCTION !== "true"
  );
}
