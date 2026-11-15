// @vitest-environment node
import { describe, expect, it } from "vitest";
import { arquivoUploadPermitido, emailValido, endpointPushPermitido, escaparHtml, nomeSeguro, sanitizarHtmlEmail } from "./seguranca";

describe("seguranca do servidor", () => {
  it("escapa HTML", () => {
    expect(escaparHtml(`<img src=x onerror="a()">&'`)).toBe("&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
  });
  it("sanitiza HTML de e-mail", () => {
    const s = sanitizarHtmlEmail(`<p onclick="x()">Oi</p><script>alert(1)</script><a href="javascript:alert(1)">l</a><a href="https://ok.com/a">k</a><img src=x onerror=a()>`);
    expect(s).not.toMatch(/script|onclick|onerror|javascript:|<img/i);
    expect(s).toContain('href="https://ok.com/a"');
    expect(s).toContain("<p>Oi</p>");
  });
  it("valida e-mail", () => {
    expect(emailValido("a@b.com")).toBe(true);
    expect(emailValido("a@b.com, x@y.com")).toBe(false);
    expect(emailValido("a b@c.com")).toBe(false);
  });
  it("restringe endpoints de push (anti-SSRF)", () => {
    expect(endpointPushPermitido("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(endpointPushPermitido("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(endpointPushPermitido("http://fcm.googleapis.com/x")).toBe(false);
    expect(endpointPushPermitido("https://169.254.169.254/latest")).toBe(false);
    expect(endpointPushPermitido("https://fcm.googleapis.com.evil.com/x")).toBe(false);
  });
  it("filtra tipos de upload", () => {
    expect(arquivoUploadPermitido("a.pdf", "application/pdf")).toBe(true);
    expect(arquivoUploadPermitido("a.html", "text/html")).toBe(false);
    expect(arquivoUploadPermitido("a.pdf", "text/html")).toBe(false);
    expect(arquivoUploadPermitido("a.exe", "application/pdf")).toBe(false);
  });
  it("normaliza nomes", () => {
    expect(nomeSeguro("../../etc/passwd")).not.toContain("/");
    expect(nomeSeguro("a'b\"c.pdf")).toBe("a_b_c.pdf");
  });
});
