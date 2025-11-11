/**
 * XML Service Implementation
 * Uses fast-xml-parser for XML operations
 */

import { XMLBuilder, XMLParser } from 'fast-xml-parser';

export class XmlService {
  private parser: XMLParser;
  private builder: XMLBuilder;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
    });

    this.builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: false,
      suppressBooleanAttributes: false,
    });
  }

  /**
   * Parse XML string to object
   */
  async parse(xml: string): Promise<any> {
    try {
      return this.parser.parse(xml);
    } catch (error) {
      throw new Error(
        `XML parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert object to XML string
   */
  async stringify(obj: any, _options?: any): Promise<string> {
    try {
      return this.builder.build(obj);
    } catch (error) {
      throw new Error(
        `XML stringification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate XML against schema (basic validation)
   */
  async validate(xml: string, _schema: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Basic XML structure validation
      this.parser.parse(xml);

      // Additional schema validation could be added here
      // For now, we just check if XML is well-formed

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown validation error');
      return { valid: false, errors };
    }
  }

  /**
   * Extract specific elements from XML
   */
  async extractElements(xml: string, xpath: string): Promise<any[]> {
    try {
      const parsed = await this.parse(xml);
      // Simple element extraction - could be enhanced with proper XPath support
      return this.extractByPath(parsed, xpath);
    } catch (error) {
      throw new Error(
        `Element extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Simple path-based extraction
   */
  private extractByPath(obj: any, path: string): any[] {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return [];
      }
    }

    return Array.isArray(current) ? current : [current];
  }
}
