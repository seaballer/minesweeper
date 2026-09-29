import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Board from './components/Board.jsx';
import ControlBar from './components/ControlBar.jsx';
import StatusBanner from './components/StatusBanner.jsx';
import { useMinesweeper } from './hooks/useMinesweeper.js';

export default function App() {
    const {
        grid,
        difficulty,
        status,
        isOver,
        minesRemaining,
        reveal,
        toggleFlag,
        reset,
        changeDifficulty,
    } = useMinesweeper();

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
            <Stack spacing={2.5}>
                <Box>
                    <Typography variant="h5" component="h1" gutterBottom>
                        Minesweeper
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Left-click to reveal, right-click to flag. Mines are placed after your
                        first click, so it is always safe.
                    </Typography>
                </Box>

                <ControlBar
                    minesRemaining={minesRemaining}
                    difficultyKey={difficulty.key}
                    onDifficultyChange={changeDifficulty}
                    onReset={reset}
                />

                <StatusBanner status={status} />

                <Box sx={{ overflowX: 'auto', pb: 1 }}>
                    <Board
                        grid={grid}
                        onReveal={reveal}
                        onFlag={toggleFlag}
                        disabled={isOver}
                    />
                </Box>
            </Stack>
        </Container>
    );
}
