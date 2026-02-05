// Vercel Serverless Function - Installation guides
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

let products = {};

function loadProducts() {
  if (Object.keys(products).length > 0) return products;
  const productsDir = join(process.cwd(), 'products');
  try {
    const skus = readdirSync(productsDir);
    for (const sku of skus) {
      const knowledgePath = join(productsDir, sku, 'knowledge.json');
      try {
        products[sku] = JSON.parse(readFileSync(knowledgePath, 'utf-8'));
      } catch (e) {}
    }
  } catch (e) {}
  return products;
}

function findProduct(query) {
  const prods = loadProducts();
  const q = query.toLowerCase().trim();
  if (prods[q]) return prods[q];
  for (const [sku, data] of Object.entries(prods)) {
    const model = data.product?.model?.toLowerCase() || '';
    if (model.includes(q) || q.includes(model)) return data;
  }
  return null;
}

function searchInstallation(product, topic) {
  const guides = product.installation_topics || [];
  const q = topic.toLowerCase();
  
  const scored = guides.map(g => {
    let score = 0;
    const topicText = g.topic?.toLowerCase() || '';
    const title = g.title?.toLowerCase() || '';
    const content = g.content?.toLowerCase() || '';
    
    const keywords = q.split(/\s+/).filter(k => k.length >= 2);
    for (const kw of keywords) {
      if (topicText.includes(kw)) score += 15;
      if (title.includes(kw)) score += 10;
      if (content.includes(kw)) score += 3;
    }
    return { ...g, score };
  });
  
  return scored.filter(g => g.score > 0).sort((a, b) => b.score - a.score);
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const params = req.method === 'POST' ? req.body : req.query;
  const { sku, model, topic } = params;
  const productQuery = sku || model;
  
  if (!productQuery) {
    return res.status(400).json({ error: 'Missing sku or model parameter' });
  }
  
  const product = findProduct(productQuery);
  if (!product) {
    return res.status(404).json({ error: 'Product not found', query: productQuery });
  }
  
  if (!topic) {
    return res.json({
      product: product.product?.model,
      installation_topics: product.installation_topics || [],
      documents: product.document_urls
    });
  }
  
  const results = searchInstallation(product, topic);
  
  return res.json({
    product: product.product?.model,
    topic,
    guides: results.length > 0 ? results : product.installation_topics,
    matched: results.length > 0,
    documents: product.document_urls
  });
}
