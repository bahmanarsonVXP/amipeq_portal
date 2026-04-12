const fs = require('fs');
const path = require('path');

/**
 * Manages mappings.json file with in-memory cache
 * Provides crash-safe immediate writes after each creation
 */
class MappingsManager {
  constructor(filePath) {
    this.filePath = filePath;

    // Load existing mappings or create new structure
    if (fs.existsSync(filePath)) {
      this.cache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else {
      this.cache = {
        companies: {},
        persons: {}
      };
      this._writeToFile();
    }
  }

  /**
   * Get company UUID by numeroSociete
   * @param {string} numeroSociete - Company number
   * @returns {string|undefined} UUID or undefined if not found
   */
  getCompany(numeroSociete) {
    return this.cache.companies[numeroSociete];
  }

  /**
   * Save company mapping (immediate write to file)
   * @param {string} numeroSociete - Company number
   * @param {string} id - TWENTY UUID
   */
  saveCompany(numeroSociete, id) {
    this.cache.companies[numeroSociete] = id;
    this._writeToFile();
  }

  /**
   * Get person UUID by numeroSociete and contact name
   * @param {string} numeroSociete - Company number
   * @param {string} contact - Full contact name
   * @returns {string|undefined} UUID or undefined if not found
   */
  getPerson(numeroSociete, contact) {
    const key = `${numeroSociete}|${contact}`;
    return this.cache.persons[key];
  }

  /**
   * Save person mapping (immediate write to file)
   * @param {string} numeroSociete - Company number
   * @param {string} contact - Full contact name
   * @param {string} id - TWENTY UUID
   */
  savePerson(numeroSociete, contact, id) {
    const key = `${numeroSociete}|${contact}`;
    this.cache.persons[key] = id;
    this._writeToFile();
  }

  /**
   * Bulk save (optimization for initial imports)
   * @param {Object} updates - { companies: {}, persons: {} }
   */
  saveBulk(updates) {
    if (updates.companies) {
      Object.assign(this.cache.companies, updates.companies);
    }
    if (updates.persons) {
      Object.assign(this.cache.persons, updates.persons);
    }
    this._writeToFile();
  }

  /**
   * Get all mappings (for debugging)
   */
  getAll() {
    return {
      companies: Object.keys(this.cache.companies).length,
      persons: Object.keys(this.cache.persons).length
    };
  }

  /**
   * Write cache to file (private method)
   */
  _writeToFile() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2));
  }
}

// Export singleton instance
const mappingsPath = path.join(__dirname, '../../mappings.json');
module.exports = new MappingsManager(mappingsPath);
