// Board sizes offered in the difficulty selector. `key` is a stable id used as
// the React key and for lookup; `label` is what the user sees.
export const DIFFICULTIES = {
    beginner: { key: 'beginner', label: 'Beginner', rows: 9, cols: 9, mineCount: 10 },
    intermediate: { key: 'intermediate', label: 'Intermediate', rows: 16, cols: 16, mineCount: 40 },
    expert: { key: 'expert', label: 'Expert', rows: 16, cols: 30, mineCount: 99 },
};

export const DEFAULT_DIFFICULTY = 'beginner';

export const DIFFICULTY_LIST = Object.values(DIFFICULTIES);
