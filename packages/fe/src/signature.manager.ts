/**
 * Digital Signature Support
 * Handles digital signatures for FatturaPA invoices
 */

import { SignatureService } from './signature.service';
import type { IStorage } from './storage.interface';

export interface SignatureConfig {
  /** File storage service */
  fileStorage: IStorage;
  /** Path to private key file (PEM format) */
  privateKeyPath?: string;
  /** Private key content (PEM format) */
  privateKey?: string;
  /** Path to certificate file (PEM format) */
  certificatePath?: string;
  /** Certificate content (PEM format) */
  certificate?: string;
  /** Signature algorithm (default: RSA-SHA256) */
  algorithm?: string;
  /** Include timestamp in signature */
  includeTimestamp?: boolean;
}

export interface SignatureResult {
  /** Signed XML content */
  signedXml: string;
  /** Signature digest */
  digest: string;
  /** Signature algorithm used */
  algorithm: string;
  /** Timestamp if included */
  timestamp?: string;
}

/**
 * Digital signature manager for FatturaPA invoices
 */
export class SignatureManager {
  private config: SignatureConfig;
  private signatureService: SignatureService;

  constructor(config: SignatureConfig) {
    this.config = {
      algorithm: 'RSA-SHA256',
      includeTimestamp: false,
      ...config,
    };
    this.signatureService = new SignatureService();
  }

  /**
   * Sign XML invoice content
   */
  async signInvoice(xmlContent: string): Promise<SignatureResult> {
    const privateKey = await this.getPrivateKey();
    const algorithm = this.config.algorithm!;

    // Create signature using the service
    const signatureResult = await this.signatureService.sign(
      Buffer.from(xmlContent, 'utf8'),
      privateKey,
      algorithm
    );

    // Generate timestamp if requested
    const timestamp = this.config.includeTimestamp ? new Date().toISOString() : undefined;

    // Create signed XML
    const signedXml = this.createSignedXml(
      xmlContent,
      signatureResult.signature,
      signatureResult.digest,
      timestamp
    );

    return {
      signedXml,
      digest: signatureResult.digest,
      algorithm: signatureResult.algorithm,
      timestamp,
    };
  }

  /**
   * Verify signature of signed XML
   */
  async verifySignature(signedXml: string): Promise<boolean> {
    try {
      const certificate = await this.getCertificate();
      const { xmlContent, signature, algorithm } = this.extractSignatureData(signedXml);

      return await this.signatureService.verify(
        Buffer.from(xmlContent, 'utf8'),
        signature,
        certificate,
        algorithm
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Get private key content
   */
  private async getPrivateKey(): Promise<string> {
    if (this.config.privateKey) {
      return this.config.privateKey;
    }

    if (this.config.privateKeyPath) {
      const keyContent = await this.config.fileStorage.retrieve(this.config.privateKeyPath);
      if (!keyContent) {
        throw new Error(`Private key file not found: ${this.config.privateKeyPath}`);
      }
      return Buffer.from(keyContent).toString('utf8');
    }

    throw new Error('Private key not provided. Set privateKey or privateKeyPath in config.');
  }

  /**
   * Get certificate content
   */
  private async getCertificate(): Promise<string> {
    if (this.config.certificate) {
      return this.config.certificate;
    }

    if (this.config.certificatePath) {
      const certContent = await this.config.fileStorage.retrieve(this.config.certificatePath);
      if (!certContent) {
        throw new Error(`Certificate file not found: ${this.config.certificatePath}`);
      }
      return Buffer.from(certContent).toString('utf8');
    }

    throw new Error('Certificate not provided. Set certificate or certificatePath in config.');
  }

  /**
   * Create signed XML with signature envelope
   */
  private createSignedXml(
    xmlContent: string,
    signature: string,
    digest: string,
    timestamp?: string
  ): string {
    // Simplified implementation - in real scenario would use proper XML signature standards
    const signatureElement = `
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:SignedInfo>
        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
        <ds:Reference URI="">
          <ds:Transforms>
            <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          </ds:Transforms>
          <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
          <ds:DigestValue>${digest}</ds:DigestValue>
        </ds:Reference>
      </ds:SignedInfo>
      <ds:SignatureValue>${signature}</ds:SignatureValue>
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${this.getCertificateContent()}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
      ${timestamp ? `<ds:Object><Timestamp>${timestamp}</Timestamp></ds:Object>` : ''}
    </ds:Signature>`;

    // Insert signature into XML (simplified - would need proper XML manipulation)
    return xmlContent.replace(
      '</p:FatturaElettronica>',
      `${signatureElement}\n</p:FatturaElettronica>`
    );
  }

  /**
   * Extract signature data from signed XML
   */
  private extractSignatureData(signedXml: string): {
    xmlContent: string;
    signature: string;
    algorithm: string;
  } {
    // Simplified implementation - would need proper XML parsing
    const signatureMatch = signedXml.match(/<ds:SignatureValue>(.*?)<\/ds:SignatureValue>/);
    const digestMatch = signedXml.match(/<ds:DigestValue>(.*?)<\/ds:DigestValue>/);

    if (!signatureMatch || !digestMatch) {
      throw new Error('Invalid signed XML format');
    }

    // Remove signature element to get original content
    const xmlContent = signedXml.replace(/<ds:Signature[\s\S]*?<\/ds:Signature>/, '');

    return {
      xmlContent,
      signature: signatureMatch[1],
      algorithm: 'RSA-SHA256',
    };
  }

  /**
   * Get certificate content for signature
   */
  private getCertificateContent(): string {
    // In real implementation, would extract certificate from config
    return 'CERTIFICATE_CONTENT_PLACEHOLDER';
  }
}

/**
 * Create a digital signature manager
 */
export function createSignatureManager(config: SignatureConfig): SignatureManager {
  return new SignatureManager(config);
}

/**
 * Sign invoice XML with digital signature
 */
export async function signInvoiceXml(
  xmlContent: string,
  config: SignatureConfig
): Promise<SignatureResult> {
  const manager = createSignatureManager(config);
  return await manager.signInvoice(xmlContent);
}

/**
 * Verify signed invoice XML
 */
export async function verifySignedInvoiceXml(
  signedXml: string,
  config: SignatureConfig
): Promise<boolean> {
  const manager = createSignatureManager(config);
  return await manager.verifySignature(signedXml);
}
