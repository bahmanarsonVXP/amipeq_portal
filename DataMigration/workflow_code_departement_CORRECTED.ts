export const main = async (params: {
  companyId: string;
  addressPostcode: string;
}): Promise<object> => {

  const { addressPostcode } = params;

  // Fonction pour calculer le département
  function extractDepartement(cp: string) {
    if (!cp) return { numero: null, code: null };

    const cpClean = String(Math.floor(Number(cp))).padStart(5, '0');

    // DOM-TOM
    if (cpClean.startsWith('971')) return { numero: '971', code: 'DEPT_971_GUADELOUPE' };
    if (cpClean.startsWith('972')) return { numero: '972', code: 'DEPT_972_MARTINIQUE' };
    if (cpClean.startsWith('973')) return { numero: '973', code: 'DEPT_973_GUYANE' };
    if (cpClean.startsWith('974')) return { numero: '974', code: 'DEPT_974_LA_R_UNION' };
    if (cpClean.startsWith('976')) return { numero: '976', code: 'DEPT_976_MAYOTTE' };

    // Corse
    if (cpClean.startsWith('20')) {
      const num = parseInt(cpClean);
      if (num < 20200) return { numero: '2A', code: 'DEPT_2A_CORSE_DU_SUD' };
      return { numero: '2B', code: 'DEPT_2B_HAUTE_CORSE' };
    }

    // Métropole - Valeurs ENUM réelles de TWENTY (avec _ au lieu des accents)
    const dept = cpClean.substring(0, 2);
    const deptCodes: Record<string, string> = {
      '01': 'DEPT_01_AIN',
      '02': 'DEPT_02_AISNE',
      '03': 'DEPT_03_ALLIER',
      '04': 'DEPT_04_ALPES_DE_HAUTE_PROVENCE',
      '05': 'DEPT_05_HAUTES_ALPES',
      '06': 'DEPT_06_ALPES_MARITIMES',
      '07': 'DEPT_07_ARD_CHE',              // ARDÈCHE → ARD_CHE
      '08': 'DEPT_08_ARDENNES',
      '09': 'DEPT_09_ARI_GE',               // ARIÈGE → ARI_GE
      '10': 'DEPT_10_AUBE',
      '11': 'DEPT_11_AUDE',
      '12': 'DEPT_12_AVEYRON',
      '13': 'DEPT_13_BOUCHES_DU_RH_NE',     // RHÔNE → RH_NE
      '14': 'DEPT_14_CALVADOS',
      '15': 'DEPT_15_CANTAL',
      '16': 'DEPT_16_CHARENTE',
      '17': 'DEPT_17_CHARENTE_MARITIME',
      '18': 'DEPT_18_CHER',
      '19': 'DEPT_19_CORR_ZE',              // CORRÈZE → CORR_ZE
      '21': 'DEPT_21_C_TE_D_OR',            // CÔTE → C_TE
      '22': 'DEPT_22_C_TES_D_ARMOR',        // CÔTES → C_TES
      '23': 'DEPT_23_CREUSE',
      '24': 'DEPT_24_DORDOGNE',
      '25': 'DEPT_25_DOUBS',
      '26': 'DEPT_26_DR_ME',                // DRÔME → DR_ME
      '27': 'DEPT_27_EURE',
      '28': 'DEPT_28_EURE_ET_LOIR',
      '29': 'DEPT_29_FINIST_RE',            // FINISTÈRE → FINIST_RE
      '30': 'DEPT_30_GARD',
      '31': 'DEPT_31_HAUTE_GARONNE',
      '32': 'DEPT_32_GERS',
      '33': 'DEPT_33_GIRONDE',
      '34': 'DEPT_34_H_RAULT',              // HÉRAULT → H_RAULT
      '35': 'DEPT_35_ILLE_ET_VILAINE',
      '36': 'DEPT_36_INDRE',
      '37': 'DEPT_37_INDRE_ET_LOIRE',
      '38': 'DEPT_38_IS_RE',                // ISÈRE → IS_RE
      '39': 'DEPT_39_JURA',
      '40': 'DEPT_40_LANDES',
      '41': 'DEPT_41_LOIR_ET_CHER',
      '42': 'DEPT_42_LOIRE',
      '43': 'DEPT_43_HAUTE_LOIRE',
      '44': 'DEPT_44_LOIRE_ATLANTIQUE',
      '45': 'DEPT_45_LOIRET',
      '46': 'DEPT_46_LOT',
      '47': 'DEPT_47_LOT_ET_GARONNE',
      '48': 'DEPT_48_LOZ_RE',               // LOZÈRE → LOZ_RE
      '49': 'DEPT_49_MAINE_ET_LOIRE',
      '50': 'DEPT_50_MANCHE',
      '51': 'DEPT_51_MARNE',
      '52': 'DEPT_52_HAUTE_MARNE',
      '53': 'DEPT_53_MAYENNE',
      '54': 'DEPT_54_MEURTHE_ET_MOSELLE',
      '55': 'DEPT_55_MEUSE',
      '56': 'DEPT_56_MORBIHAN',
      '57': 'DEPT_57_MOSELLE',
      '58': 'DEPT_58_NI_VRE',               // NIÈVRE → NI_VRE
      '59': 'DEPT_59_NORD',
      '60': 'DEPT_60_OISE',
      '61': 'DEPT_61_ORNE',
      '62': 'DEPT_62_PAS_DE_CALAIS',
      '63': 'DEPT_63_PUY_DE_D_ME',          // DÔME → D_ME
      '64': 'DEPT_64_PYR_N_ES_ATLANTIQUES', // PYRÉNÉES → PYR_N_ES
      '65': 'DEPT_65_HAUTES_PYR_N_ES',      // PYRÉNÉES → PYR_N_ES
      '66': 'DEPT_66_PYR_N_ES_ORIENTALES',  // PYRÉNÉES → PYR_N_ES
      '67': 'DEPT_67_BAS_RHIN',
      '68': 'DEPT_68_HAUT_RHIN',
      '69': 'DEPT_69_RH_NE',                // RHÔNE → RH_NE
      '70': 'DEPT_70_HAUTE_SA_NE',          // SAÔNE → SA_NE
      '71': 'DEPT_71_SA_NE_ET_LOIRE',       // SAÔNE → SA_NE
      '72': 'DEPT_72_SARTHE',
      '73': 'DEPT_73_SAVOIE',
      '74': 'DEPT_74_HAUTE_SAVOIE',
      '75': 'DEPT_75_PARIS',
      '76': 'DEPT_76_SEINE_MARITIME',
      '77': 'DEPT_77_SEINE_ET_MARNE',
      '78': 'DEPT_78_YVELINES',
      '79': 'DEPT_79_DEUX_S_VRES',          // SÈVRES → S_VRES
      '80': 'DEPT_80_SOMME',
      '81': 'DEPT_81_TARN',
      '82': 'DEPT_82_TARN_ET_GARONNE',
      '83': 'DEPT_83_VAR',
      '84': 'DEPT_84_VAUCLUSE',
      '85': 'DEPT_85_VEND_E',               // VENDÉE → VEND_E
      '86': 'DEPT_86_VIENNE',
      '87': 'DEPT_87_HAUTE_VIENNE',
      '88': 'DEPT_88_VOSGES',
      '89': 'DEPT_89_YONNE',
      '90': 'DEPT_90_TERRITOIRE_DE_BELFORT',
      '91': 'DEPT_91_ESSONNE',
      '92': 'DEPT_92_HAUTS_DE_SEINE',
      '93': 'DEPT_93_SEINE_SAINT_DENIS',
      '94': 'DEPT_94_VAL_DE_MARNE',
      '95': 'DEPT_95_VAL_D_OISE'
    };

    const code = deptCodes[dept];
    if (code) {
      return { numero: dept, code };
    }

    return { numero: dept, code: null };
  }

  // Calculer le département
  const dept = extractDepartement(addressPostcode);

  return {
    departement: dept.code,
    departementNumero: dept.numero
  };
};
