const calculateTimeDifference = (startDate: Date, endDate?: Date): number => {
  if (!endDate) {
    endDate = new Date();
  }
  const diff = endDate.getTime() - startDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const createGameSlug = (title: string): string => {
  return title
    .replace(/&/g, ' and ')
    .replace(/[-–+/]/g, ' ')
    .replace(/['’‘‚‛]/g, '\'')
    .replace(/["“”„‟]/g, '"')
    .replace(/[:;,.!?()[\]{}]/g, ' ')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ').trim()
    .replace(/ /g, '-')
    .toLowerCase()
    .replace(/^(a|an|the) (.*)$/, '$2, $1');
};

const formatTitle = (title: string): string => {
  return title
    .replace(/[™Ⓡ®]/g, '')
    .replace(/['’‘‚‛]/g, '\'')
    .replace(/["“”„‟]/g, '"')
    .replace(/[-–]/g, '-')
    .replace(/\s+/g, ' ').trim();
};

export { calculateTimeDifference, createGameSlug, formatTitle };