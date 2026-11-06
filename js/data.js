/* ==========================================================================
   K ROL NAILS : données modifiables du site
   --------------------------------------------------------------------------
   Pour renseigner un tarif : remplacer `null` par un texte, ex. '35 €' ou
   'à partir de 35 €'. Tant que la valeur est `null`, le site affiche
   « Sur demande ». Aucun autre fichier à toucher.
   ========================================================================== */
window.KROL = {
  nom: 'K Rol Nails',
  tel: '+33686988611',
  telAffiche: '06 86 98 86 11',
  email: 'chante.carole@orange.fr',
  adresse: '10 boulevard Gassendi, 04000 Digne-les-Bains',

  /* Horaires affichés sur Google Maps (lundi au vendredi, 9 h à 19 h). 0 = dimanche */
  horaires: {
    1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19],
    6: null, 0: null
  },

  /* TARIFS : à compléter avec Carole (aucun prix public trouvé) */
  prix: {
    fullcover: null,
    french: null,
    fleurs: null,
    glitters: null,
    fantasy: null,
    fil: null
  },

  /* Prestations proposées dans le formulaire de réservation */
  prestations: [
    { id: 'fullcover', nom: 'Full cover' },
    { id: 'french',    nom: 'French' },
    { id: 'fleurs',    nom: 'Flowers (fleurs et marguerites)' },
    { id: 'glitters',  nom: 'Glitters' },
    { id: 'fantasy',   nom: 'Fantasy (nail art libre)' },
    { id: 'fil',       nom: 'Épilation au fil' },
    { id: 'conseil',   nom: 'Je ne sais pas encore : conseil' }
  ],

  /* Créneaux proposés (début) : de 9 h à 17 h 30, toutes les 30 minutes */
  creneaux: { debut: 9, fin: 17.5, pas: 0.5 },
  joursAffiches: 15
};
