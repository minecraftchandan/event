export const eventConfig = {
  commands: {
    myStats: ['mystats', 'ems'],
  },
 rarityAp: {
    common: { value: 1, emojiId: '1545097827623899146', emojiName: 'common', label: 'Common' },
    uncommon: { value: 2, emojiId: '1545097825501708358', emojiName: 'uncommon', label: 'Uncommon' },
    rare: { value: 3, emojiId: '1545097823198912572', emojiName: 'rare', label: 'Rare' },
    exotic: { value: 5, emojiId: '1545097820489650226', emojiName: 'exotic', label: 'Exotic' },
    legendary: { value: 7, emojiId: '1545097810762924042', emojiName: 'legendary', label: 'Legendary' },
  },
  dropMilestones: [
    { cards: 20, bonus: 50, label: '20 cards' },
    { cards: 30, bonus: 150, label: '30 cards' },
    { cards: 40, bonus: 300, label: '40 cards' },
    { cards: 50, bonus: 500, label: '50 cards' },
  ],
  clashMilestones: [
    { clashes: 40, bonus: 100, label: '40 clashes' },
    { clashes: 80, bonus: 200, label: '80 clashes' },
    { clashes: 120, bonus: 350, label: '120 clashes' },
    { clashes: 200, bonus: 550, label: '200 clashes' },
  ],
  rarityOrder: ['common', 'uncommon', 'rare', 'exotic', 'legendary'],
};

export default eventConfig;
