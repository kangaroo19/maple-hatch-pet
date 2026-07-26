import { useMemo, useState, type FormEvent } from 'react'
import { getCharacter, type CharacterBasic } from './api'
import './App.css'

const actions = [
  ['A00', '기본 자세 1'],
  ['A01', '기본 자세 2'],
  ['A02', '걷기 1'],
  ['A03', '걷기 2'],
  ['A04', '엎드리기'],
  ['A05', '비행'],
  ['A06', '점프'],
  ['A07', '앉기'],
]

const emotions = [
  ['E00', '기본'],
  ['E01', '윙크'],
  ['E02', '웃음'],
  ['E03', '울음'],
  ['E04', '화남'],
  ['E05', '당황'],
]

function App() {
  const [name, setName] = useState('')
  const [character, setCharacter] = useState<CharacterBasic | null>(null)
  const [action, setAction] = useState('A00')
  const [emotion, setEmotion] = useState('E00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installMessage, setInstallMessage] = useState('')

  const imageUrl = useMemo(() => {
    if (!character) return ''

    const url = new URL(character.character_image)
    url.searchParams.set('action', action)
    url.searchParams.set('emotion', emotion)
    url.searchParams.set('width', '400')
    url.searchParams.set('height', '400')
    url.searchParams.set('x', '200')
    url.searchParams.set('y', '280')
    return url.toString()
  }, [character, action, emotion])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('캐릭터 닉네임을 입력해 주세요.')
      return
    }

    setLoading(true)
    setError('')
    setCharacter(null)

    try {
      setCharacter(await getCharacter(trimmedName))
      setAction('A00')
      setEmotion('E00')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : '조회에 실패했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleInstallMaplePet() {
    if (!character) return

    setInstalling(true)
    setInstallMessage('')

    try {
      const response = await fetch('/api/install-maple-pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: character.character_name,
          worldName: character.world_name,
          characterClass: character.character_class,
          characterImage: character.character_image,
        }),
      })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.message)
      }

      setInstallMessage(body.message)
    } catch (caughtError) {
      setInstallMessage(
        caughtError instanceof Error ? caughtError.message : '설치에 실패했습니다.',
      )
    } finally {
      setInstalling(false)
    }
  }

  return (
    <main>
      <h1>메이플 캐릭터 조회</h1>

      <form onSubmit={handleSubmit}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="캐릭터 닉네임"
        />
        <button type="submit" disabled={loading}>
          조회
        </button>
      </form>

      {loading && <p>조회 중...</p>}
      {error && <p className="error">{error}</p>}

      {character && (
        <section>
          <img src={imageUrl} alt={`${character.character_name} 캐릭터`} />

          <dl>
            <dt>이름</dt>
            <dd>{character.character_name}</dd>
            <dt>월드</dt>
            <dd>{character.world_name}</dd>
            <dt>직업</dt>
            <dd>{character.character_class}</dd>
            <dt>레벨</dt>
            <dd>{character.character_level}</dd>
          </dl>

          <div className="controls">
            <label>
              액션
              <select value={action} onChange={(event) => setAction(event.target.value)}>
                {actions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              표정
              <select value={emotion} onChange={(event) => setEmotion(event.target.value)}>
                {emotions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <button type="button" onClick={handleInstallMaplePet} disabled={installing}>
            {installing ? 'Pet 생성 중...' : '이 캐릭터를 Codex Pet으로 설치'}
          </button>
          {installMessage && <p>{installMessage}</p>}

        </section>
      )}
    </main>
  )
}

export default App
