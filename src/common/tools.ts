const calculateTimeDifference = (startDate: Date, endDate?: Date): number => {
  if (!endDate) {
    endDate = new Date();
  }
  const diff = endDate.getTime() - startDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export { calculateTimeDifference };