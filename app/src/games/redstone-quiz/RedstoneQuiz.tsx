// ============================================================
// Redstone Quiz — sentence context fill-in-the-blank, multiple choice
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameWord, GameProgress } from '../../types';
import { RedstoneQuizEngine } from './RedstoneQuizEngine';
import type { QuestionData } from './RedstoneQuizEngine';
import { speakWord, speakSequence } from '../../services/speech';
import { playClick, playBlockBreak, playFail, playGameComplete } from '../../services/sound';
import { useApp } from '../../store/AppContext';

interface RedstoneQuizProps {
  words: GameWord[];
  onAnswer: (wordId: string, correct: boolean, responseTimeMs: number) => void;
  onComplete: (progress: GameProgress) => void;
}

export default function RedstoneQuiz({ words, onAnswer, onComplete }: RedstoneQuizProps) {
  const { state } = useApp();
  const soundEnabled = state.settings.soundEnabled;
  const engineRef = useRef<RedstoneQuizEngine | null>(null);
  const [questionData, setQuestionData] = useState<QuestionData | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    correctAnswer: string;
    selectedAnswer: string;
  } | null>(null);
  const [progress, setProgress] = useState<GameProgress>({
    currentQuestion: 0, totalQuestions: 0, correctCount: 0,
    incorrectCount: 0, xpEarned: 0, isComplete: false,
  });
  const [isComplete, setIsComplete] = useState(false);
  const answerStartRef = useRef<number>(Date.now());

  useEffect(() => {
    const engine = new RedstoneQuizEngine();
    engine.initialize(words);
    engineRef.current = engine;
    loadQuestion(engine);
    answerStartRef.current = Date.now();
  }, [words]);

  const loadQuestion = useCallback((engine: RedstoneQuizEngine) => {
    const q = engine.nextQuestion();
    if (!q) {
      setIsComplete(true);
      setProgress(engine.getProgress());
      onComplete(engine.getProgress());
      if (soundEnabled) playGameComplete();
      return;
    }

    const data = engine.getCurrentQuestionData();
    setQuestionData(data);
    setSelectedOption(null);
    setFeedback(null);
    answerStartRef.current = Date.now();

    // Speech: word → instruction → sentence → word
    (async () => {
      await speakWord(q.correctAnswer, 0.85);
      await new Promise(r => setTimeout(r, 400));
      await speakSequence([
        { text: '选择正确的单词填入句子', lang: 'zh', pauseMs: 400 },
        { text: q.prompt, lang: 'en', pauseMs: 800 },
      ]);
      await speakWord(q.correctAnswer, 0.85);
    })().catch(() => {});
  }, [onComplete, soundEnabled]);

  const handleOptionClick = useCallback(
    (option: string) => {
      if (!engineRef.current || !questionData || feedback) return;

      if (soundEnabled) playClick();

      setSelectedOption(option);

      const responseTimeMs = Date.now() - answerStartRef.current;
      const result = engineRef.current.submitAnswer(option);

      if (result.correct) {
        if (soundEnabled) playBlockBreak();

        setFeedback({
          correct: true,
          correctAnswer: result.correctAnswer,
          selectedAnswer: option,
        });

        onAnswer(questionData.wordId, true, responseTimeMs);
        setProgress(engineRef.current.getProgress());

        setTimeout(() => {
          speakWord(result.correctAnswer).catch(() => {});
        }, 200);

        setTimeout(() => {
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 1500);
      } else {
        if (soundEnabled) playFail();

        setFeedback({
          correct: false,
          correctAnswer: result.correctAnswer,
          selectedAnswer: option,
        });

        onAnswer(questionData.wordId, false, responseTimeMs);
        setProgress(engineRef.current.getProgress());

        setTimeout(() => {
          speakWord(result.correctAnswer, 0.85).catch(() => {});
        }, 400);

        setTimeout(() => {
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 3500);
      }
    },
    [questionData, feedback, onAnswer, loadQuestion, soundEnabled]
  );

  // Completion screen
  if (isComplete) {
    return (
      <div className="flex-col gap-md" style={{ alignItems: 'center', padding: 32 }}>
        <div className="pixel-text" style={{ color: 'var(--color-gold)', fontSize: 16 }}>
          🔴 Quiz Complete!
        </div>
        <div className="flex" style={{ gap: 32, marginTop: 8 }}>
          <StatBox label="Correct" value={`${progress.correctCount}`} color="var(--color-xp)" />
          <StatBox label="Misses" value={`${progress.incorrectCount}`} color="var(--color-redstone)" />
          <StatBox label="XP" value={`+${progress.xpEarned}`} color="var(--color-gold)" />
        </div>
      </div>
    );
  }

  if (!questionData) {
    return (
      <div className="flex-center" style={{ height: 200 }}>
        <span className="pixel-text" style={{ color: 'var(--text-muted)' }}>
          Charging redstone circuits...
        </span>
      </div>
    );
  }

  // Build the segmented sentence display: split on ______ to show context + blank
  const sentenceParts = questionData.sentenceWithBlank.split('______');

  return (
    <div className="flex-col gap-md" style={{ padding: 16 }}>
      {/* Progress header */}
      <div>
        <div className="flex-between" style={{ marginBottom: 4 }}>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            Question {progress.currentQuestion + 1}/{progress.totalQuestions}
          </span>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            ⭐ {progress.xpEarned} XP
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: `${(progress.currentQuestion / Math.max(progress.totalQuestions, 1)) * 100}%`,
              background: 'linear-gradient(90deg, var(--color-redstone-dim), var(--color-redstone))',
            }}
          />
        </div>
      </div>

      {/* Sentence panel — redstone themed */}
      <div
        className="mc-panel"
        style={{
          padding: '20px 16px',
          textAlign: 'center',
          borderColor: 'rgba(255,82,82,0.2) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(255,82,82,0.1)',
          background: 'linear-gradient(180deg, rgba(255,82,82,0.05) 0%, rgba(150,30,30,0.03) 100%)',
        }}
      >
        <div className="pixel-text-sm" style={{ color: 'var(--text-muted)', fontSize: 7, marginBottom: 12 }}>
          🔴 COMPLETE THE SENTENCE
        </div>

        {/* Sentence with blank */}
        <div
          style={{
            fontSize: 15,
            color: '#FFF',
            lineHeight: 1.8,
            marginBottom: 12,
            animation: 'fadeInUp 0.3s ease-out',
          }}
        >
          {sentenceParts.map((part, i) => (
            <span key={i}>
              {part}
              {i < sentenceParts.length - 1 && (
                <span
                  style={{
                    display: 'inline-block',
                    minWidth: 80,
                    padding: '2px 8px',
                    margin: '0 2px',
                    borderBottom: '3px solid var(--color-redstone)',
                    color: 'var(--color-redstone)',
                    fontWeight: 700,
                  }}
                >
                  {feedback && !feedback.correct
                    ? feedback.correctAnswer.toUpperCase()
                    : feedback && feedback.correct
                      ? feedback.correctAnswer.toUpperCase()
                      : '?'}
                </span>
              )}
            </span>
          ))}
        </div>

        {/* Chinese translation hint */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}
        >
          💡 {questionData.sentenceChinese}
        </div>
      </div>

      {/* Feedback */}
      <div style={{ minHeight: 32, textAlign: 'center' }}>
        {feedback && feedback.correct && (
          <div
            style={{
              animation: 'fadeInUp 0.2s ease-out',
              color: 'var(--color-xp)',
              fontSize: 13,
            }}
          >
            ✅ 正确！
          </div>
        )}
        {feedback && !feedback.correct && (
          <div
            style={{
              animation: 'fadeInUp 0.3s ease-out',
              color: 'var(--color-redstone)',
              fontSize: 14,
              fontWeight: 700,
              padding: '8px 16px',
              background: 'rgba(255,70,70,0.1)',
              borderRadius: 6,
              border: '1px solid rgba(255,70,70,0.3)',
            }}
          >
            ❌ 正确答案：<span style={{ fontSize: 18, letterSpacing: 1 }}>{feedback.correctAnswer}</span>
          </div>
        )}
      </div>

      {/* 2×2 Option Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          maxWidth: 400,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {questionData.options.map((option, i) => {
          const isSelected = selectedOption === option;
          const isCorrectAnswer = feedback && option.toLowerCase() === feedback.correctAnswer.toLowerCase();
          const isWrongSelected = feedback && !feedback.correct && isSelected;

          let borderColor = 'rgba(255,82,82,0.12)';
          let bg = 'var(--bg-surface)';
          let textColor = '#FFF';

          if (isWrongSelected) {
            borderColor = 'var(--color-redstone)';
            bg = 'rgba(255,70,70,0.12)';
            textColor = 'var(--color-redstone)';
          } else if (isCorrectAnswer && feedback) {
            borderColor = 'var(--color-xp)';
            bg = 'rgba(128,255,32,0.08)';
            textColor = 'var(--color-xp)';
          } else if (isSelected && feedback?.correct) {
            borderColor = 'var(--color-xp)';
            bg = 'rgba(128,255,32,0.08)';
            textColor = 'var(--color-xp)';
          }

          return (
            <button
              key={i}
              className="mc-panel"
              onClick={() => handleOptionClick(option)}
              disabled={!!feedback}
              style={{
                padding: '16px 12px',
                fontSize: 18,
                fontWeight: 700,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                color: textColor,
                background: bg,
                borderColor: `${borderColor} rgba(0,0,0,0.4) rgba(0,0,0,0.4) ${borderColor}`,
                cursor: feedback ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'center',
                minHeight: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: isWrongSelected ? 'blockShake 0.4s ease-out' : undefined,
              }}
              onMouseEnter={(e) => {
                if (!feedback) {
                  e.currentTarget.style.borderColor = 'rgba(255,82,82,0.4) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(255,82,82,0.3)';
                  e.currentTarget.style.background = 'rgba(255,82,82,0.06)';
                }
              }}
              onMouseLeave={(e) => {
                if (!feedback) {
                  e.currentTarget.style.borderColor = 'rgba(255,82,82,0.12) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(255,82,82,0.1)';
                  e.currentTarget.style.background = 'var(--bg-surface)';
                }
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Combo indicator */}
      {engineRef.current && engineRef.current.getComboCount() >= 3 && !feedback && (
        <div style={{ textAlign: 'center' }}>
          <span className="pixel-text-sm" style={{ color: 'var(--color-gold)', fontSize: 9 }}>
            🔥 {engineRef.current.getComboCount()}x Combo!
          </span>
        </div>
      )}

      {/* Phonetic hint */}
      {questionData.phonetic && (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            🔊 /{questionData.phonetic}/
          </span>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-col" style={{ alignItems: 'center' }}>
      <div className="pixel-text-sm" style={{ fontSize: 16, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
