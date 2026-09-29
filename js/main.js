import { Grid } from "./Grid.js";

const grid = new Grid(9,9,10);
grid.initialize();

console.log(grid);

console.table(grid.cells.map(row => row.map(cell => cell.isMine ? '*' : cell.neighborMines)));
