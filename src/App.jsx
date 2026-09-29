import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Board from './components/Board.jsx';
import ControlBar from './components/ControlBar.jsx';
import StatusBanner from './components/StatusBanner.jsx';
import { useMinesweeper } from './hooks/useMinesweeper.js';

export default function App() {
    const theme = useTheme();
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
        allMinesFlagged,
    } = useMinesweeper();

    return (
        <Container maxWidth="md" sx={{ py: { xs: 3, sm: 6 } }}>
            <Stack spacing={3}>
                {/* Title block sits left-aligned against a centered board, so the
                    two are deliberately misaligned rather than stacked flush. */}
                <Box sx={{ pl: 0.5 }}>
                    <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ mb: 0.5, alignItems: 'baseline' }}
                    >
                        <Typography variant="h5" component="h1">
                            Minesweeper
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                fontFamily: theme.mono,
                                color: 'primary.main',
                                letterSpacing: '0.08em',
                            }}
                        >
                            {difficulty.rows}×{difficulty.cols} / {difficulty.mineCount} mines
                        </Typography>
                    </Stack>
                    <Typography variant="body2">
                        Left-click to reveal, right-click or press F to flag. The field is
                        laid out on your first click, so that one is always safe.
                    </Typography>
                </Box>

                <ControlBar
                    minesRemaining={minesRemaining}
                    allMinesFlagged={allMinesFlagged}
                    difficultyKey={difficulty.key}
                    onDifficultyChange={changeDifficulty}
                    onReset={reset}
                />

                <StatusBanner status={status} />

                <Box sx={{ overflowX: 'auto', pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', minWidth: 'fit-content' }}>
                        <Board
                            grid={grid}
                            onReveal={reveal}
                            onFlag={toggleFlag}
                            disabled={isOver}
                        />
                    </Box>
                </Box>
            </Stack>
        </Container>
    );
}
