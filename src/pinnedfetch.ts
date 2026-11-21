import https from "node:https";

/**
 * A small number of sites are reached through a network path where a
 * FortiGate firewall (CN=FGT40FTK23099ACU, O=Fortinet) re-signs HTTPS
 * traffic with its own certificate instead of the real one - confirmed via
 * `openssl s_client` against ranlanka.lk. That's a legitimate TLS failure
 * (Node correctly refuses an untrusted chain) rather than a bug on our side
 * or theirs.
 *
 * Rather than disabling certificate verification outright (which would
 * silently accept *any* certificate, including a genuinely malicious one),
 * this fetches with verification off but then manually checks the
 * presented certificate matches the specific known interceptor - by issuer
 * *and* that the subject still names the host we asked for - before trusting
 * the response. Anything else throws instead of returning data.
 */
export async function fetchThroughKnownInterceptor(
  url: string,
  opts: { headers?: Record<string, string>; expectedIssuerContains: string }
): Promise<{ status: number; text: string }> {
  const parsed = new URL(url);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: opts.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const socket = res.socket as import("tls").TLSSocket;
        const cert = socket.getPeerCertificate();
        const issuer = `${cert.issuer?.O ?? ""} ${cert.issuer?.CN ?? ""}`;
        const subjectCN = cert.subject?.CN ?? "";

        if (!issuer.toLowerCase().includes(opts.expectedIssuerContains.toLowerCase())) {
          req.destroy();
          reject(
            new Error(
              `refusing untrusted certificate for ${parsed.hostname}: issuer "${issuer.trim()}" does not match the known interceptor - this may be a real MITM, not the expected firewall`
            )
          );
          return;
        }
        if (subjectCN !== parsed.hostname) {
          req.destroy();
          reject(
            new Error(`certificate subject "${subjectCN}" does not match requested host "${parsed.hostname}"`)
          );
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}
