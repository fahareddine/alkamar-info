// api/_lib/images/provider.js
// Interface + ReplicateProvider pour suppression de fond via Replicate BRIA-RMBG-2.0

const Replicate = require('replicate');

class ReplicateProvider {
  constructor() {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN manquant');
    }
    this.client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }

  /**
   * Supprime le fond d'une image via Replicate BRIA-RMBG-2.0
   * @param {string} imageUrl - URL publique ou signée de l'image source
   * @returns {Promise<Buffer>} Buffer PNG fond transparent
   */
  async removeBackground(imageUrl) {
    const output = await this.client.run(
      'briaai/BRIA-RMBG-2.0',
      { input: { image: imageUrl } }
    );
    // output est une URL vers le PNG résultant
    const resultUrl = Array.isArray(output) ? output[0] : output;
    const response = await fetch(resultUrl);
    if (!response.ok) {
      throw new Error(`Échec téléchargement résultat Replicate: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

module.exports = { ReplicateProvider };
