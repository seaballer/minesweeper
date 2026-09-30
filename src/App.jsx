import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import Board from './components/Board.jsx';
import ControlBar from './components/ControlBar.jsx';
import DifficultySelect from './components/DifficultySelect.jsx';
import ControlsInfo from './components/ControlsInfo.jsx';
import StatusBanner from './components/StatusBanner.jsx';
import CustomSettings from './components/CustomSettings.jsx';
import { useMinesweeper } from './hooks/useMinesweeper.js';
import { useResetShortcut } from './hooks/useResetShortcut.js';
import { CUSTOM_KEY } from './game/difficulties.js';

export default function App() {
    const theme = useTheme();
    const {
        grid,
        version,
        difficulty,
        customSize,
        status,
        isOver,
        minesRemaining,
        elapsed,
        timerRunning,
        reveal,
        toggleFlag,
        reset,
        changeDifficulty,
        allMinesFlagged,
        chord,
        applyCustomSize,
    } = useMinesweeper();

    // Owned here so the R shortcut can stand down while the controls dialog is
    // open — otherwise the dialog that documents R wipes the live game.
    const [controlsOpen, setControlsOpen] = useState(false);
    useResetShortcut(reset, controlsOpen);

    return (
        // `xl`, not `md`: cells are a fixed 30px, so an Expert board is 1021px
        // wide. A 960px cap would scroll it horizontally, which is exactly the
        // problem the constant cell size traded away.
        <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 6 } }}>
            {/* Info lives in the corner, out of the centered column's way. */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <ControlsInfo open={controlsOpen} onOpenChange={setControlsOpen} />
            </Box>

            <Stack spacing={2}>
                {/* Wordmark, centered over the board it titles. */}
                <Box sx={{ textAlign: 'center' }}>
                    <Typography
                        component="h1"
                        sx={{
                            fontSize: { xs: 30, sm: 40 },
                            fontWeight: 700,
                            lineHeight: 1,
                            letterSpacing: '0.22em',
                            textTransform: 'uppercase',
                            // Trailing tracking widens the inline box by a full
                            // letter-space, all of it on the right, which leaves
                            // the visible glyphs half of that left of centre.
                            // Indenting by the other half re-centres them.
                            textIndent: '0.11em',
                            color: theme.wordmark.top,
                            // Gradient text fill is temporarily disabled: it
                            // renders incorrectly at some browser zoom levels
                            // and the fix was not worth further time here.
                            // Restore by uncommenting the block below; the
                            // title falls back to the flat colour above, which
                            // is readable on its own.
                            // backgroundImage:
                            //     `linear-gradient(180deg, ${theme.wordmark.top} 0%, ${theme.wordmark.mid} 55%, ${theme.wordmark.bottom} 100%)`,
                            // backgroundSize: '100% 100%',
                            // backgroundClip: 'text',
                            // WebkitBackgroundClip: 'text',
                            // willChange: 'transform',
                            // transform: 'translateZ(0)',
                            // WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Minesweeper
                    </Typography>
                </Box>

                <DifficultySelect
                    difficultyKey={difficulty.key}
                    onDifficultyChange={changeDifficulty}
                />

                {difficulty.key === CUSTOM_KEY && (
                    // Keyed on the applied config so applying a new size resets
                    // the drafts, rather than an effect syncing them.
                    <CustomSettings
                        key={`${customSize.rows}-${customSize.cols}-${customSize.mineCount}`}
                        value={customSize}
                        onApply={applyCustomSize}
                    />
                )}

                <StatusBanner status={status} />

                {/* Readouts and board share one centred column, so the counter
                    lines up with the first column of cells and the timer with
                    the last, at any board size. Scrolls as a unit if a board
                    exceeds the available width, which means an oversized custom
                    board or a narrow phone. Cells themselves never shrink. */}
                <Box sx={{ overflowX: 'auto', pb: 1 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            justifyContent: 'center',
                            width: 'fit-content',
                            minWidth: 'fit-content',
                            mx: 'auto',
                        }}
                    >
                        <ControlBar
                            minesRemaining={minesRemaining}
                            allMinesFlagged={allMinesFlagged}
                            elapsed={elapsed}
                            timerRunning={timerRunning}
                            onReset={reset}
                        />

                        {/* Breathing room so the readouts don't crowd the bezel. */}
                        <Box sx={{ height: 6 }} />

                        <Board
                            grid={grid}
                            // Bumped on every model mutation. Board is
                            // `memo`ized and reads a model that mutates in
                            // place, so without this it would never repaint.
                            // See the note on `version` in useMinesweeper.
                            version={version}
                            onReveal={reveal}
                            onFlag={toggleFlag}
                            onChord={chord}
                            disabled={isOver}
                        />
                    </Box>
                </Box>
            </Stack>
        </Container>
    );
}
