// The plan chosen on "Подписка" travels to the store screen.
export type PlanChoice = { tier: 'plus' | 'premium'; period: 'month' | 'year' };
let choice: PlanChoice = { tier: 'plus', period: 'month' };
export const getPlanChoice = () => choice;
export const setPlanChoice = (c: PlanChoice) => { choice = c; };
