// Vercel Serverless Function - Health check and API info
import { readdirSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  let productCount = 0;
  try {
    const productsDir = join(process.cwd(), 'products');
    productCount = readdirSync(productsDir).length;
  } catch (e) {}

  return res.json({
    name: "Sonance Tech Support API",
    version: "1.0.0",
    status: "ok",
    products_loaded: productCount,
    endpoints: {
      "GET /api/products": "List all products",
      "GET /api/products?sku=93548": "Get product by SKU",
      "GET /api/products?model=UA 2-125": "Get product by model name",
      "POST /api/troubleshoot": "Get troubleshooting help { sku, issue }",
      "POST /api/faq": "Search FAQs { sku, question }",
      "GET /api/install?sku=93548&topic=hdmi": "Get installation guide"
    },
    support: {
      phone: "(949) 492-7777",
      website: "www.sonance.com"
    }
  });
}
