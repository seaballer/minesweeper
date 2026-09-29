import { Grid } from "./Grid.js";

const grid = new Grid(9, 9, 10);
grid.initialize();

// Mines are placed lazily on the first reveal so the opening click is safe,
// so a reveal is needed before the board has anything to show.
grid.revealCell(4, 4);

console.log(grid);

console.table(grid.cells.map(row => row.map(cell => cell.isMine ? '*' : cell.neighborMines)));
