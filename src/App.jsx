import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { collection, doc, getDoc, getDocs, getFirestore, orderBy, query, setDoc } from 'firebase/firestore'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
}

const FIREBASE_COLLECTIONS = {
  pages: import.meta.env.VITE_FIREBASE_PORTFOLIO_COLLECTION || 'portfolio_pages',
  projects: import.meta.env.VITE_FIREBASE_PROJECTS_COLLECTION || 'portfolio_projects',
}

const FIREBASE_REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId']

const STORAGE_KEY = 'whomi-editor-v1'
const GITHUB_STORAGE_KEY = 'whomi-github-settings-v1'
const DB_STORAGE_KEY = 'whomi-db-settings-v1'

const getFirebaseConfigError = () => {
  const missing = FIREBASE_REQUIRED_KEYS.filter((key) => !FIREBASE_CONFIG[key])
  return missing.length ? `Firebase 환경변수가 부족합니다: ${missing.join(', ')}` : ''
}

const getFirebaseApp = () => {
  const configError = getFirebaseConfigError()
  if (configError) {
    throw new Error(configError)
  }

  if (!getApps().length) {
    return initializeApp(FIREBASE_CONFIG)
  }

  return getApp()
}

const getFirebaseDb = () => getFirestore(getFirebaseApp())

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const clone = (value) => JSON.parse(JSON.stringify(value))
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const normalizeText = (value, fallback = '') => {
  const text = String(value || '').trim()
  return text || fallback
}

const formatRepoTech = (repo) => {
  const list = []
  if (Array.isArray(repo.topics)) list.push(...repo.topics.filter(Boolean))
  if (repo.language) list.push(repo.language)
  return list.length ? [...new Set(list)].join(', ') : '미지정'
}

const buildProjectFromRepo = (repo) => ({
  id: createId(),
  title: normalizeText(repo.name, 'GitHub 프로젝트'),
  type: repo.private ? 'GitHub / 비공개' : 'GitHub / 공개',
  tech: formatRepoTech(repo),
  language: normalizeText(repo.language, '미지정'),
  overview: normalizeText(repo.description, 'GitHub 저장소에서 불러온 프로젝트입니다.'),
  purpose: normalizeText(repo.purpose, '포트폴리오 프로젝트 정리'),
  image: '',
  repoUrl: normalizeText(repo.html_url, ''),
  firebaseId: '',
})

const buildProjectFromFirebaseDoc = (row) => {
  const firebaseId = row?.id == null ? '' : String(row.id)
  return {
    id: createId(),
    firebaseId,
    title: normalizeText(row?.title || row?.name, 'Firebase 프로젝트'),
    type: normalizeText(row?.type || row?.category, 'Firebase / 프로젝트'),
    tech: normalizeText(row?.tech || row?.technologies || row?.stack, '미지정'),
    language: normalizeText(row?.language || row?.lang, '미지정'),
    overview: normalizeText(row?.overview || row?.description || row?.desc, 'Firebase 저장소에서 불러온 프로젝트입니다.'),
    purpose: normalizeText(row?.purpose || row?.goal || row?.objective, '포트폴리오 프로젝트 정리'),
    image: normalizeText(row?.image || row?.image_url || row?.imageUrl, ''),
    repoUrl: normalizeText(row?.repoUrl || row?.repo_url || row?.repoURL || row?.url, ''),
  }
}

const SKILL_COLUMN_CLASSES = ['library-column', 'front-column', 'backend-column']
const SKILL_CARD_CLASSES = ['skill-card-large', 'skill-card-front', 'skill-card-backend']
const SKILL_TWEENS = [
  {
    selector: '.skill-bottom-word',
    from: { yPercent: 72, scale: 0.62, opacity: 0.25 },
    to: { yPercent: -6, scale: 1.12, opacity: 1 },
    start: 'top 92%',
    end: 'bottom 45%',
    scrub: 1,
  },
  {
    selector: '.library-column',
    from: { x: -120, y: 96, scale: 0.92, opacity: 0 },
    to: { x: 0, y: -12, scale: 1, opacity: 1 },
    start: 'top 82%',
    end: 'center 50%',
    scrub: 1,
  },
  {
    selector: '.front-column',
    from: { x: 140, y: 150, scale: 0.9, opacity: 0 },
    to: { x: 0, y: -18, scale: 1, opacity: 1 },
    start: 'top 78%',
    end: 'center 42%',
    scrub: 1,
  },
  {
    selector: '.backend-column',
    from: { x: 220, y: 72, scale: 0.92, opacity: 0 },
    to: { x: 0, y: -10, scale: 1, opacity: 1 },
    start: 'top 64%',
    end: 'bottom 54%',
    scrub: 1,
  },
  {
    selector: '.project-list',
    from: { x: 260 },
    to: { x: -180 },
    start: 'top 82%',
    end: 'bottom 20%',
    scrub: 1.1,
  },
]

const defaultData = {
  hero: {
    badge: 'THIS PAGE MADE BY REACT | GSAP | SCSS, TAKE A LOOK AROUND',
    kicker: '웹 개발 포트폴리오',
    titleLines: ['웹', '개발', '포트폴리오'],
    copy:
      '이름1의 작업을 담는 포트폴리오입니다. 검은 배경, 큰 타이포, 좌측 정렬, 아래로 길게 이어지는 흐름을 기준으로 원본의 리듬에 맞춰 정리했습니다.',
    meta: [
      { id: createId(), label: '역할', value: '프론트엔드 / 웹 개발' },
      { id: createId(), label: '방향', value: '부드럽고 자연스러운 인터랙션' },
      { id: createId(), label: '형태', value: '원페이지 포트폴리오' },
    ],
    actions: [
      { id: createId(), label: '프로젝트 보기', href: '#projects', variant: 'primary' },
      { id: createId(), label: '이력 보기', href: '#career', variant: 'secondary' },
    ],
    portraitLabel: '사진1',
    portraitImage: '',
    portraitCaptionTop: '웹 개발',
    portraitCaptionBottom: '포트폴리오',
  },
  interview: {
    tag: 'INTERVIEW',
    questions: [
      {
        id: createId(),
        title: 'Q. 프론트엔드를 지향하는 이유',
        answer:
          '사용자와의 상호작용을 직접 만들고 싶었고, 화면의 반응을 섬세하게 다듬는 작업에 매력을 느껴 프론트엔드 개발을 계속하고 있습니다.',
      },
      {
        id: createId(),
        title: 'Q. 일에 있어 가장 중요하게 생각하는 것이 있다면?',
        answer:
          '직관적인 UI, 명확한 구조, 그리고 사용자 중심의 흐름입니다. 정보가 눈에 걸리지 않고 자연스럽게 읽히도록 만드는 쪽을 더 선호합니다.',
      },
      {
        id: createId(),
        title: 'Q. 자기계발을 위해 어떤 것들을 해왔는지?',
        answer:
          '스터디, 사이드 프로젝트, 라이브러리 실험을 반복하면서 감각과 구현력을 같이 키우는 쪽으로 학습해왔습니다.',
      },
    ],
    portraitLabel: '김상준 이미지',
    portraitImage: '',
  },
  career: {
    tag: 'CAREER',
    title: '커리어',
    copy: '학습과 실무 경험을 분리해서 보이도록 정리한 이력 구간입니다.',
    items: [
      {
        id: createId(),
        title: '주식회사 메이즈',
        desc:
          '사용자 흐름과 유지 보수성을 함께 고려하며 웹 화면의 구조를 다듬는 작업을 진행했습니다.',
        bullets: ['React 기반 UI 작업', '상태와 화면 구조 정리', '반응형 및 스크롤 흐름 조정'],
      },
      {
        id: createId(),
        title: '라인컴퓨터아트학원',
        desc: 'React, PHP 기초, 알고리즘, GSAP, Swiper 등 다양한 라이브러리와 웹 표준, SEO를 함께 학습했습니다.',
        bullets: ['3개의 JavaScript 프로젝트', '2개의 React 프로젝트', '1개의 PHP 프로젝트'],
      },
    ],
  },
  skills: {
    tag: 'SKILL',
    railWord: 'PORTFOLIO',
    railIndex: '2024-2026',
    marquee: 'THIS PAGE MADE BY REACT | GSAP | SCSS, TAKE A LOOK AROUND',
    bottomWord: 'SKILL',
    groups: [
      {
        id: createId(),
        title: '라이브러리',
        items: [
          { id: createId(), name: 'Bootstrap', desc: '플레이스홀더 HTML을 빠르게 스타일링할 수 있게 사용했습니다.' },
          { id: createId(), name: 'Swiper', desc: '다양한 슬라이드 형태를 구현하는 데 사용했습니다.' },
          { id: createId(), name: 'Lenis', desc: '부드러운 스크롤 제어가 필요한 화면에 적용했습니다.' },
          { id: createId(), name: 'jQuery', desc: '간단한 DOM 제어와 기존 코드 유지 보수에 사용했습니다.' },
        ],
      },
      {
        id: createId(),
        title: '프론트',
        items: [
          { id: createId(), name: 'React', desc: '컴포넌트 구조와 Hooks를 활용해 화면을 개발했습니다.' },
          { id: createId(), name: 'Zustand', desc: '리액트 상태를 단순하고 빠르게 관리하기 위해 사용했습니다.' },
          { id: createId(), name: 'Svelte', desc: '간단한 상태 관리와 반응형 기능을 실험했습니다.' },
          { id: createId(), name: 'Next JS', desc: '정적 사이트 생성과 서버 사이드 렌더링 구조를 학습했습니다.' },
        ],
      },
      {
        id: createId(),
        title: '백엔드',
        items: [
          { id: createId(), name: 'PHP', desc: '게시글 작성 및 삭제 같은 기본 CRUD를 구현했습니다.' },
          { id: createId(), name: 'MySQL', desc: '정형 데이터를 저장하고 조회하는 흐름을 다뤘습니다.' },
        ],
      },
    ],
  },
  projects: {
    tag: 'PROJECTS',
    title: '프로젝트',
    items: [
      {
        id: createId(),
        title: '프로젝트1',
        type: '브랜딩 / 랜딩 페이지',
        tech: 'React, GSAP',
        language: 'JavaScript',
        overview: '큰 타이포와 강한 대비를 중심으로 시작하는 소개형 프로젝트입니다.',
        purpose: '브랜드 소개와 시각적 임팩트 전달',
        image: '',
        repoUrl: '',
        firebaseId: '',
      },
      {
        id: createId(),
        title: '프로젝트2',
        type: '콘텐츠 / 인터랙션',
        tech: 'React, ScrollTrigger',
        language: 'JavaScript',
        overview: '스크롤에 맞춰 화면이 아래로 흘러가며, 섹션 전환이 자연스럽게 이어집니다.',
        purpose: '섹션 전환과 인터랙션 경험 전달',
        image: '',
        repoUrl: '',
        firebaseId: '',
      },
      {
        id: createId(),
        title: '프로젝트3',
        type: '실험 / 개인 작업',
        tech: 'HTML, CSS',
        language: 'JavaScript',
        overview: '학습과 개인 작업을 플레이스홀더 기반으로 정리한 예시 카드입니다.',
        purpose: '실험 결과와 학습 정리',
        image: '',
        repoUrl: '',
        firebaseId: '',
      },
      {
        id: createId(),
        title: '프로젝트4',
        type: '리뉴얼 / 포트폴리오',
        tech: 'React, CSS Modules',
        language: 'TypeScript',
        overview: '좌우 배치와 긴 여백을 살려 원본의 프로젝트 리스트 감각을 흉내 낸 섹션입니다.',
        purpose: '포트폴리오 리뉴얼과 구조 정리',
        image: '',
        repoUrl: '',
        firebaseId: '',
      },
    ],
  },
  contact: {
    tag: 'CONTACT',
    title: '연락처 영역',
    copy: '이메일, 깃허브, 노션 같은 링크를 붙이면 바로 사용 가능합니다.',
    email: 'name1@example.com',
    buttons: [
      { id: createId(), label: 'name1@example.com', href: 'mailto:name1@example.com', variant: 'primary' },
      { id: createId(), label: '맨 위로', href: '#home', variant: 'secondary' },
    ],
  },
}

function normalizeData(raw) {
  const next = clone(defaultData)
  if (!raw || typeof raw !== 'object') return next

  const merge = (section) => ({ ...next[section], ...(raw[section] || {}) })
  next.hero = merge('hero')
  next.interview = merge('interview')
  next.career = merge('career')
  next.skills = merge('skills')
  next.projects = merge('projects')
  next.contact = merge('contact')

  next.hero.titleLines = Array.isArray(raw.hero?.titleLines) && raw.hero.titleLines.length ? raw.hero.titleLines.slice(0, 3) : next.hero.titleLines
  next.hero.meta = Array.isArray(raw.hero?.meta) && raw.hero.meta.length ? raw.hero.meta.map((item) => ({ id: item.id || createId(), label: item.label || '', value: item.value || '' })) : next.hero.meta
  next.hero.actions = Array.isArray(raw.hero?.actions) && raw.hero.actions.length ? raw.hero.actions.map((item) => ({ id: item.id || createId(), label: item.label || '', href: item.href || '#', variant: item.variant || 'primary' })) : next.hero.actions

  next.interview.questions = Array.isArray(raw.interview?.questions) && raw.interview.questions.length
    ? raw.interview.questions.map((item) => ({ id: item.id || createId(), title: item.title || '', answer: item.answer || '' }))
    : next.interview.questions

  next.career.items = Array.isArray(raw.career?.items) && raw.career.items.length
    ? raw.career.items.map((item) => ({
        id: item.id || createId(),
        title: item.title || '',
        desc: item.desc || '',
        bullets: Array.isArray(item.bullets) ? item.bullets : String(item.bulletsText || '').split('\n').map((line) => line.trim()).filter(Boolean),
      }))
    : next.career.items

  next.skills.groups = Array.isArray(raw.skills?.groups) && raw.skills.groups.length
    ? raw.skills.groups.map((group) => ({
        id: group.id || createId(),
        title: group.title || '',
        items: Array.isArray(group.items)
          ? group.items.map((item) => ({ id: item.id || createId(), name: item.name || '', desc: item.desc || '' }))
          : [],
      }))
    : next.skills.groups

  next.projects.items = Array.isArray(raw.projects?.items) && raw.projects.items.length
    ? raw.projects.items.map((item) => ({
        id: item.id || createId(),
        title: item.title || '',
        type: item.type || '',
        tech: item.tech || item.technologies || '',
        language: item.language || '',
        overview: item.overview || item.desc || '',
        purpose: item.purpose || '',
        image: item.image || '',
        repoUrl: item.repoUrl || '',
        firebaseId: item.firebaseId || '',
      }))
    : next.projects.items

  next.contact.buttons = Array.isArray(raw.contact?.buttons) && raw.contact.buttons.length
    ? raw.contact.buttons.map((item) => ({ id: item.id || createId(), label: item.label || '', href: item.href || '#', variant: item.variant || 'secondary' }))
    : next.contact.buttons

  return next
}

function loadStoredData() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    return normalizeData(raw)
  } catch {
    return clone(defaultData)
  }
}

function loadStoredGithubState() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(GITHUB_STORAGE_KEY) || 'null')
    if (!raw || typeof raw !== 'object') return { owner: '', token: '', repos: [], lastFetchedAt: '' }

    return {
      owner: raw.owner || '',
      token: raw.token || '',
      repos: Array.isArray(raw.repos) ? raw.repos : [],
      lastFetchedAt: raw.lastFetchedAt || '',
    }
  } catch {
    return { owner: '', token: '', repos: [], lastFetchedAt: '' }
  }
}

function loadStoredDbState() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DB_STORAGE_KEY) || 'null')
    if (!raw || typeof raw !== 'object') {
      return {
        pagesCollection: FIREBASE_COLLECTIONS.pages,
        pageDocId: 'whomi-firebase-main',
        projectsCollection: FIREBASE_COLLECTIONS.projects,
        lastLoadedAt: '',
        lastSavedAt: '',
      }
    }

    return {
      pagesCollection: raw.pagesCollection || 'portfolio_pages',
      pageDocId: raw.pageDocId || 'whomi-firebase-main',
      projectsCollection: raw.projectsCollection || 'portfolio_projects',
      lastLoadedAt: raw.lastLoadedAt || '',
      lastSavedAt: raw.lastSavedAt || '',
    }
  } catch {
    return {
      pagesCollection: FIREBASE_COLLECTIONS.pages,
      pageDocId: 'whomi-firebase-main',
      projectsCollection: FIREBASE_COLLECTIONS.projects,
      lastLoadedAt: '',
      lastSavedAt: '',
    }
  }
}

function getModeFromHash() {
  return window.location.hash === '#setting' ? 'setting' : 'preview'
}

function splitLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function inlinePreviewText(value, placeholder, type) {
  const text = String(value || '').trim()
  if (type === 'password') return text ? '입력됨' : placeholder || '비어 있음'
  return text || placeholder || '비어 있음'
}

function SelectField({ label, value, onChange, children }) {
  const [isEditing, setIsEditing] = useState(false)
  const preview = inlinePreviewText(value, '', 'text')

  return (
    <div className={`field inline-field${isEditing ? ' is-editing' : ''}`}>
      <div className="field-row-head">
        <span>{label}</span>
        <button
          className="tiny-button"
          type="button"
          onClick={() => {
            if (isEditing && typeof window !== 'undefined' && typeof window.__WHOMI_SAVE__ === 'function') {
              window.__WHOMI_SAVE__()
            }
            setIsEditing((prev) => !prev)
          }}
        >
          {isEditing ? '저장' : '수정'}
        </button>
      </div>
      {isEditing ? (
        <select autoFocus value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
      ) : (
        <button className="inline-field-preview" type="button" onClick={() => setIsEditing(true)}>
          <strong>{preview}</strong>
          <span>클릭해서 수정</span>
        </button>
      )}
    </div>
  )
}

function CompactRowEditor({ label, value, onChange, placeholder, className = '' }) {
  const [isEditing, setIsEditing] = useState(false)
  const handleToggle = () => {
    if (isEditing && typeof window !== 'undefined' && typeof window.__WHOMI_SAVE__ === 'function') {
      window.__WHOMI_SAVE__()
    }
    setIsEditing((prev) => !prev)
  }

  return (
    <div className={`compact-row-editor ${className}${isEditing ? ' is-editing' : ''}`}>
      <div className="compact-row-shell">
        <span className="compact-row-label">{label}</span>
        {isEditing ? (
          <input autoFocus type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <button className="compact-row-value" type="button" onClick={handleToggle}>
            <strong>{inlinePreviewText(value, placeholder, 'text')}</strong>
          </button>
        )}
      </div>
      <button className="tiny-button inline-span-button" type="button" onClick={handleToggle}>
        {isEditing ? '저장' : '수정'}
      </button>
    </div>
  )
}

function InlineSpanEditor({ value, onChange, placeholder, className = '', textClassName = '', multiline = false, rows = 3, type = 'text' }) {
  const [isEditing, setIsEditing] = useState(false)
  const text = inlinePreviewText(value, placeholder, type)
  const handleToggle = () => {
    if (isEditing && typeof window !== 'undefined' && typeof window.__WHOMI_SAVE__ === 'function') {
      window.__WHOMI_SAVE__()
    }
    setIsEditing((prev) => !prev)
  }

  return (
    <span className={`inline-span-editor ${className}${isEditing ? ' is-editing' : ''}`}>
      {isEditing ? (
        multiline ? (
          <textarea autoFocus rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input autoFocus type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        )
      ) : (
        <span className={`inline-span-text ${textClassName}`} onClick={handleToggle} role="button" tabIndex={0}>
          {text}
        </span>
      )}
      <button className="tiny-button inline-span-button" type="button" onClick={handleToggle}>
        {isEditing ? '저장' : '수정'}
      </button>
    </span>
  )
}

function App() {
  const [mode, setMode] = useState(getModeFromHash)
  const [data, setData] = useState(loadStoredData)
  const [githubState, setGithubState] = useState(loadStoredGithubState)
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubError, setGithubError] = useState('')
  const [githubStatus, setGithubStatus] = useState('')
  const [dbState, setDbState] = useState(loadStoredDbState)
  const [dbLoading, setDbLoading] = useState(false)
  const [dbError, setDbError] = useState('')
  const [dbStatus, setDbStatus] = useState('')
  const [firebaseProjects, setFirebaseProjects] = useState({ rows: [], lastFetchedAt: '' })
  const [firebaseProjectsLoading, setFirebaseProjectsLoading] = useState(false)
  const [firebaseProjectsError, setFirebaseProjectsError] = useState('')
  const [firebaseProjectsStatus, setFirebaseProjectsStatus] = useState('')
  const savedAt = dbState.lastSavedAt ? new Date(dbState.lastSavedAt).toLocaleString('ko-KR', { hour12: true }) : ''
  const isSettingMode = mode === 'setting'
  useEffect(() => {
    const syncHash = () => {
      const nextMode = getModeFromHash()
      setMode(nextMode)

      if (nextMode === 'preview') {
        const hash = window.location.hash.replace('#', '')
        if (hash) {
          requestAnimationFrame(() => {
            document.getElementById(hash)?.scrollIntoView({ block: 'start' })
          })
        }
      }
    }

    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // no-op
    }
  }, [data])

  useEffect(() => {
    try {
      window.localStorage.setItem(GITHUB_STORAGE_KEY, JSON.stringify(githubState))
    } catch {
      // no-op
    }
  }, [githubState])

  useEffect(() => {
    try {
      window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(dbState))
    } catch {
      // no-op
    }
  }, [dbState])

  useEffect(() => {
    if (mode !== 'preview') return undefined

    const ctx = gsap.context(() => {
      gsap.from('.topbar, .hero-badge, .hero-kicker, .hero-title-line, .hero-copy, .hero-meta, .hero-actions, .hero-portrait', {
        opacity: 0,
        y: 24,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.07,
      })

      gsap.to('.hero-orb', {
        y: 16,
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })

      gsap.utils.toArray('.section-heading, .about-panel, .career-card, .project-card, .contact-panel').forEach((item) => {
        const title = item.querySelector('.section-title, h2, h3')
        const tag = item.querySelector('.section-tag, .project-type')
        const copy = item.querySelector('.section-copy, p:not(.section-copy):not(.project-type)')

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: item,
            start: 'top 84%',
            end: 'bottom 50%',
            scrub: 0.9,
          },
        })

        tl.fromTo(item, { opacity: 0, y: 96, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, ease: 'none' })

        if (title) {
          tl.fromTo(title, { opacity: 0, y: 58, scale: 0.82 }, { opacity: 1, y: 0, scale: 1, ease: 'none' }, 0)
        }

        if (tag) {
          tl.fromTo(tag, { opacity: 0, y: 28, scale: 0.88 }, { opacity: 1, y: 0, scale: 1, ease: 'none' }, 0.08)
        }

        if (copy) {
          tl.fromTo(copy, { opacity: 0, y: 44, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, ease: 'none' }, 0.12)
        }

        if (item.classList.contains('project-card')) {
          tl.fromTo(item, { x: 300 }, { x: -120, ease: 'none' }, 0)
        }
      })

      gsap.utils.toArray('.reveal-up').forEach((item) => {
        gsap.fromTo(
          item,
          { opacity: 0, y: 72 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 86%',
            },
          },
        )
      })

      SKILL_TWEENS.forEach(({ selector, from, to, start, end, scrub }) => {
        gsap.fromTo(selector, from, {
          ...to,
          ease: 'none',
          scrollTrigger: {
            trigger: selector === '.project-list' ? '.section-projects' : '.skill-stage',
            start,
            end,
            scrub,
          },
        })
      })

      gsap.to('.skill-marquee span', {
        xPercent: -45,
        ease: 'none',
        scrollTrigger: {
          trigger: '.skill-stage',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
        },
      })
    })

    return () => ctx.revert()
  }, [data, mode])

  const updateSection = (section, patch) => {
    setData((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }))
  }

  const updateArrayItem = (section, arrayName, id, patch) => {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [arrayName]: prev[section][arrayName].map((item) => (item.id === id ? { ...item, ...patch } : item)),
      },
    }))
  }

  const updateNestedArrayItem = (section, arrayName, groupId, nestedName, itemId, patch) => {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [arrayName]: prev[section][arrayName].map((group) =>
          group.id !== groupId
            ? group
            : {
                ...group,
                [nestedName]: group[nestedName].map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
              },
        ),
      },
    }))
  }

  const updateImageFile = async (section, key, file) => {
    if (!file) return
    const url = await fileToDataUrl(file)
    setData((prev) => ({ ...prev, [section]: { ...prev[section], [key]: url } }))
  }

  const updateGithubSetting = (key, value) => {
    setGithubState((prev) => ({ ...prev, [key]: value }))
  }

  const updateDbSetting = (key, value) => {
    setDbState((prev) => ({ ...prev, [key]: value }))
  }

  const clearGithubResults = () => {
    setGithubError('')
    setGithubStatus('')
  }

  const clearDbResults = () => {
    setDbError('')
    setDbStatus('')
  }

  const clearFirebaseProjectResults = () => {
    setFirebaseProjectsError('')
    setFirebaseProjectsStatus('')
  }

  const fetchGithubRepos = async () => {
    const owner = githubState.owner.trim()
    const token = githubState.token.trim()

    if (!owner && !token) {
      setGithubError('깃 아이디 또는 토큰을 먼저 입력해 주세요.')
      return
    }

    setGithubLoading(true)
    clearGithubResults()

    try {
      const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      }

      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const endpoint = owner
        ? `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated&type=owner`
        : 'https://api.github.com/user/repos?per_page=100&sort=updated&type=owner'

      const response = await fetch(endpoint, { headers })
      if (!response.ok) {
        throw new Error(`GitHub API 요청 실패 (${response.status})`)
      }

      const repos = await response.json()
      const normalized = Array.isArray(repos)
        ? repos
            .filter((repo) => repo && repo.name)
            .map((repo) => ({
              id: repo.id,
              name: repo.name,
              fullName: repo.full_name || `${repo.owner?.login || owner}/${repo.name}`,
              description: repo.description || '',
              language: repo.language || '',
              topics: Array.isArray(repo.topics) ? repo.topics : [],
              html_url: repo.html_url,
              private: Boolean(repo.private),
            }))
        : []

      setGithubState((prev) => ({
        ...prev,
        repos: normalized,
        lastFetchedAt: new Date().toISOString(),
      }))
      setGithubStatus(`${normalized.length}개 저장소를 불러왔습니다.`)
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'GitHub 저장소를 불러오지 못했습니다.')
    } finally {
      setGithubLoading(false)
    }
  }

  const fetchDbPortfolio = async () => {
    const pagesCollection = dbState.pagesCollection.trim()
    const pageDocId = dbState.pageDocId.trim()

    if (!pagesCollection || !pageDocId) {
      setDbError('Firebase 컬렉션명과 문서 ID를 먼저 입력해 주세요.')
      return
    }

    setDbLoading(true)
    clearDbResults()

    try {
      const db = getFirebaseDb()
      const snapshot = await getDoc(doc(db, pagesCollection, pageDocId))

      if (!snapshot.exists()) {
        throw new Error('저장된 포트폴리오 데이터가 없습니다.')
      }

      const nextSnapshotData = snapshot.data() || {}
      const nextData = nextSnapshotData.payload
      if (!nextData || typeof nextData !== 'object') {
        throw new Error('저장된 포트폴리오 데이터가 없습니다.')
      }

      setData(clone(nextData))
      setDbState((prev) => {
        const nextSettings = nextSnapshotData.settings && typeof nextSnapshotData.settings === 'object' ? nextSnapshotData.settings : {}

        return {
          ...prev,
          pagesCollection: nextSettings.pagesCollection || prev.pagesCollection,
          pageDocId: nextSettings.pageDocId || prev.pageDocId,
          projectsCollection: nextSettings.projectsCollection || prev.projectsCollection,
          lastLoadedAt: new Date().toISOString(),
        }
      })
      setDbStatus('Firebase에서 포트폴리오를 불러왔습니다.')
    } catch (error) {
      setDbError(error instanceof Error ? error.message : 'Firebase에서 불러오지 못했습니다.')
    } finally {
      setDbLoading(false)
    }
  }

  const saveDbPortfolio = useCallback(async () => {
    const pagesCollection = dbState.pagesCollection.trim()
    const pageDocId = dbState.pageDocId.trim()

    if (!pagesCollection || !pageDocId) {
      setDbError('Firebase 컬렉션명과 문서 ID를 먼저 입력해 주세요.')
      return
    }

    setDbLoading(true)
    clearDbResults()

    try {
      const db = getFirebaseDb()
      await setDoc(
        doc(db, pagesCollection, pageDocId),
        {
          payload: clone(data),
          settings: {
            pagesCollection,
            pageDocId,
            projectsCollection: dbState.projectsCollection.trim(),
          },
        },
        { merge: true },
      )

      setDbState((prev) => ({ ...prev, lastSavedAt: new Date().toISOString() }))
      setDbStatus('현재 포트폴리오를 Firebase에 저장했습니다.')
    } catch (error) {
      setDbError(error instanceof Error ? error.message : 'Firebase에 저장하지 못했습니다.')
    } finally {
      setDbLoading(false)
    }
  }, [data, dbState])

  const fetchFirebaseProjects = async () => {
    const projectsCollection = dbState.projectsCollection.trim()

    if (!projectsCollection) {
      setFirebaseProjectsError('Firebase 프로젝트 컬렉션명을 먼저 입력해 주세요.')
      return
    }

    setFirebaseProjectsLoading(true)
    clearFirebaseProjectResults()

    try {
      const db = getFirebaseDb()
      const snapshots = await getDocs(query(collection(db, projectsCollection), orderBy('title')))
      const normalized = snapshots.docs
        .filter(Boolean)
        .map((snapshot) => ({ ...buildProjectFromFirebaseDoc({ id: snapshot.id, ...snapshot.data() }), source: 'firebase' }))

      setFirebaseProjects({ rows: normalized, lastFetchedAt: new Date().toISOString() })
      setFirebaseProjectsStatus(`${normalized.length}개 프로젝트를 불러왔습니다.`)
    } catch (error) {
      setFirebaseProjectsError(error instanceof Error ? error.message : '프로젝트 목록을 불러오지 못했습니다.')
    } finally {
      setFirebaseProjectsLoading(false)
    }
  }

  const importFirebaseProject = (row) => {
    const project = buildProjectFromFirebaseDoc(row)

    setData((prev) => {
      const index = prev.projects.items.findIndex(
        (item) =>
          item.firebaseId && item.firebaseId === project.firebaseId,
      )

      if (index === -1) {
        return {
          ...prev,
          projects: {
            ...prev.projects,
            items: [project, ...prev.projects.items],
          },
        }
      }

      return {
        ...prev,
        projects: {
          ...prev.projects,
          items: prev.projects.items.map((item, currentIndex) => (currentIndex === index ? { ...item, ...project, id: item.id } : item)),
        },
      }
    })
  }

  const importGithubRepo = async (repo) => {
    try {
      setGithubLoading(true)
      clearGithubResults()

      const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      }

      if (githubState.token.trim()) {
        headers.Authorization = `Bearer ${githubState.token.trim()}`
      }

      const detailResponse = await fetch(`https://api.github.com/repos/${repo.fullName}`, { headers })
      const detail = detailResponse.ok ? await detailResponse.json() : repo
      const project = buildProjectFromRepo({
        ...repo,
        ...detail,
        topics: Array.isArray(detail.topics) ? detail.topics : repo.topics,
      })

      setData((prev) => {
        const index = prev.projects.items.findIndex((item) => item.repoUrl && item.repoUrl === project.repoUrl)
        if (index === -1) {
          return {
            ...prev,
            projects: {
              ...prev.projects,
              items: [project, ...prev.projects.items],
            },
          }
        }

        const nextItems = prev.projects.items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...project, id: item.id } : item,
        )

        return {
          ...prev,
          projects: {
            ...prev.projects,
            items: nextItems,
          },
        }
      })

      setGithubStatus(`"${project.title}" 프로젝트를 추가했습니다.`)
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : '프로젝트로 추가하지 못했습니다.')
    } finally {
      setGithubLoading(false)
    }
  }

  const addHeroMeta = () =>
    setData((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        meta: [...prev.hero.meta, { id: createId(), label: '새 항목', value: '새 값' }],
      },
    }))

  const addHeroAction = () =>
    setData((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        actions: [...prev.hero.actions, { id: createId(), label: '새 버튼', href: '#', variant: 'secondary' }],
      },
    }))

  const addInterviewQuestion = () =>
    setData((prev) => ({
      ...prev,
      interview: {
        ...prev.interview,
        questions: [...prev.interview.questions, { id: createId(), title: '새 질문', answer: '새 답변' }],
      },
    }))

  const addCareerItem = () =>
    setData((prev) => ({
      ...prev,
      career: {
        ...prev.career,
        items: [...prev.career.items, { id: createId(), title: '새 경력', desc: '설명을 입력하세요.', bullets: ['항목 1', '항목 2'] }],
      },
    }))

  const addSkillGroup = () =>
    setData((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        groups: [...prev.skills.groups, { id: createId(), title: '새 그룹', items: [{ id: createId(), name: '새 스킬', desc: '설명을 입력하세요.' }] }],
      },
    }))

  const addSkillItem = (groupId) =>
    setData((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        groups: prev.skills.groups.map((group) =>
          group.id !== groupId
            ? group
            : { ...group, items: [...group.items, { id: createId(), name: '새 스킬', desc: '설명을 입력하세요.' }] },
        ),
      },
    }))

  const addProject = () =>
    setData((prev) => ({
      ...prev,
      projects: {
        ...prev.projects,
        items: [
          ...prev.projects.items,
          {
            id: createId(),
            title: '새 프로젝트',
            type: '카테고리',
            tech: '',
            language: '',
            overview: '설명을 입력하세요.',
            purpose: '',
            image: '',
            repoUrl: '',
          },
        ],
      },
    }))

  const addContactButton = () =>
    setData((prev) => ({
      ...prev,
      contact: {
        ...prev.contact,
        buttons: [...prev.contact.buttons, { id: createId(), label: '새 버튼', href: '#', variant: 'secondary' }],
      },
    }))

  const resetData = () => {
    const next = clone(defaultData)
    setData(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    const nextGithub = { owner: '', token: '', repos: [], lastFetchedAt: '' }
    setGithubState(nextGithub)
    setGithubError('')
    setGithubStatus('')
    try {
      window.localStorage.setItem(GITHUB_STORAGE_KEY, JSON.stringify(nextGithub))
    } catch {
      // no-op
    }
  }

  const exportJson = useMemo(() => JSON.stringify(data, null, 2), [data])

  if (typeof window !== 'undefined' && window.__WHOMI_KEEP_UNUSED__) {
    void [
      splitLines,
      githubLoading,
      githubError,
      githubStatus,
      dbError,
      dbStatus,
      firebaseProjects,
      firebaseProjectsLoading,
      firebaseProjectsError,
      firebaseProjectsStatus,
      savedAt,
      updateNestedArrayItem,
      updateGithubSetting,
      updateDbSetting,
      fetchGithubRepos,
      fetchDbPortfolio,
      fetchFirebaseProjects,
      importFirebaseProject,
      importGithubRepo,
      addHeroMeta,
      addHeroAction,
      addInterviewQuestion,
      addCareerItem,
      addSkillGroup,
      addSkillItem,
      addProject,
      addContactButton,
      resetData,
      exportJson,
    ]
  }

  const renderSettingsPanel = () => null

  const renderPortfolioPage = () => (
    <div className="page-shell">
      <header className="topbar reveal-up">
        <a className="brand" href="#home" aria-label="홈으로 이동">
          <span className="brand-dot" />
          <span className="brand-line">프론트-엔드</span>
          <span className="brand-divider">/</span>
          <span className="brand-line">이름1</span>
        </a>

        <nav className="nav" aria-label="주요 메뉴">
          <a href="#about">인터뷰</a>
          <a href="#career">이력</a>
          <a href="#skill">기술</a>
          <a href="#projects">프로젝트</a>
          <a href="#setting">설정</a>
        </nav>
      </header>

      <main>
        <section className="hero reveal-up" id="home">
          <div className="hero-copy-column">
            <div className="hero-badge-row">
              {isSettingMode ? (
                <InlineSpanEditor
                  className="hero-badge-inline"
                  textClassName="hero-badge"
                  value={data.hero.badge}
                  onChange={(value) => updateSection('hero', { badge: value })}
                  placeholder="배지 문구"
                />
              ) : (
                <p className="hero-badge">{data.hero.badge}</p>
              )}
            </div>

            <div className="hero-kicker-row">
              {isSettingMode ? (
                <InlineSpanEditor
                  className="hero-kicker-inline"
                  textClassName="hero-kicker"
                  value={data.hero.kicker}
                  onChange={(value) => updateSection('hero', { kicker: value })}
                  placeholder="상단 안내 문구"
                />
              ) : (
                <p className="hero-kicker">{data.hero.kicker}</p>
              )}
            </div>

            <h1 className="hero-title" aria-label={data.hero.titleLines.join(' ')}>
              {data.hero.titleLines.map((line, index) =>
                isSettingMode ? (
                  <InlineSpanEditor
                    key={`hero-title-${index}`}
                    className="hero-title-line-editor"
                    textClassName="hero-title-line"
                    value={line}
                    onChange={(value) => updateSection('hero', { titleLines: data.hero.titleLines.map((current, currentIndex) => (currentIndex === index ? value : current)) })}
                    placeholder="제목 줄"
                  />
                ) : (
                  <span className="hero-title-line" key={`${line}-${index}`}>
                    {line}
                  </span>
                ),
              )}
            </h1>

            <div className="hero-copy-row">
              {isSettingMode ? (
                <InlineSpanEditor
                  className="hero-copy-inline"
                  textClassName="hero-copy"
                  multiline
                  rows={4}
                  value={data.hero.copy}
                  onChange={(value) => updateSection('hero', { copy: value })}
                  placeholder="소개 문구"
                />
              ) : (
                <p className="hero-copy">{data.hero.copy}</p>
              )}
            </div>

            <div className="hero-meta">
              {data.hero.meta.map((item) => (
                <div className="meta-chip" key={item.id}>
                  <span>
                    {isSettingMode ? (
                      <InlineSpanEditor
                        className="meta-label-inline"
                        textClassName="meta-label"
                        value={item.label}
                        onChange={(value) => updateArrayItem('hero', 'meta', item.id, { label: value })}
                        placeholder="라벨"
                      />
                    ) : (
                      item.label
                    )}
                  </span>
                  <strong>
                    {isSettingMode ? (
                      <InlineSpanEditor
                        className="meta-value-inline"
                        textClassName="meta-value"
                        value={item.value}
                        onChange={(value) => updateArrayItem('hero', 'meta', item.id, { value })}
                        placeholder="값"
                      />
                    ) : (
                      item.value
                    )}
                  </strong>
                </div>
              ))}
            </div>

            <div className="hero-actions">
              {data.hero.actions.map((action) => (
                <div className={`hero-action-item${isSettingMode ? ' is-editing' : ''}`} key={action.id}>
                  <div className="hero-action-preview">
                    <a className={`button ${action.variant === 'primary' ? 'primary' : 'secondary'}`} href={action.href}>
                      {action.label}
                    </a>
                    {isSettingMode ? (
                      <button className="tiny-button hero-action-save" type="button" onClick={() => saveDbPortfolio()} disabled={dbLoading}>
                        {dbLoading ? '저장 중...' : '저장'}
                      </button>
                    ) : null}
                  </div>
                  {isSettingMode ? (
                    <div className="hero-action-edit hero-action-edit-overlay">
                      <CompactRowEditor
                        label="라벨"
                        value={action.label}
                        onChange={(value) => updateArrayItem('hero', 'actions', action.id, { label: value })}
                        placeholder="버튼 라벨"
                      />
                      <CompactRowEditor
                        label="링크"
                        value={action.href}
                        onChange={(value) => updateArrayItem('hero', 'actions', action.id, { href: value })}
                        placeholder="#"
                      />
                      <SelectField
                        label="종류"
                        value={action.variant}
                        onChange={(value) => updateArrayItem('hero', 'actions', action.id, { variant: value })}
                      >
                        <option value="primary">primary</option>
                        <option value="secondary">secondary</option>
                      </SelectField>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="hero-portrait" aria-label="사진1 영역">
            <div className="hero-orb hero-orb-1" />
            <div className="hero-orb hero-orb-2" />
            <div className="portrait-frame">
              <div className="portrait-photo">
                <span className="portrait-label">{data.hero.portraitLabel}</span>
                <div className="portrait-art" aria-hidden="true">
                  {data.hero.portraitImage ? (
                    <img className="portrait-upload" src={data.hero.portraitImage} alt="" />
                  ) : (
                    <>
                      <div className="portrait-face" />
                      <div className="portrait-glow portrait-glow-1" />
                      <div className="portrait-glow portrait-glow-2" />
                    </>
                  )}
                </div>
                <div className="portrait-caption">
                  <span>{data.hero.portraitCaptionTop}</span>
                  <strong>{data.hero.portraitCaptionBottom}</strong>
                </div>

                {isSettingMode ? (
                  <div className="portrait-edit-strip portrait-edit-overlay">
                    <CompactRowEditor
                      label="사진 라벨"
                      value={data.hero.portraitLabel}
                      onChange={(value) => updateSection('hero', { portraitLabel: value })}
                      placeholder="사진 라벨"
                    />
                    <CompactRowEditor
                      label="캡션 상단"
                      value={data.hero.portraitCaptionTop}
                      onChange={(value) => updateSection('hero', { portraitCaptionTop: value })}
                      placeholder="캡션 상단"
                    />
                    <CompactRowEditor
                      label="캡션 하단"
                      value={data.hero.portraitCaptionBottom}
                      onChange={(value) => updateSection('hero', { portraitCaptionBottom: value })}
                      placeholder="캡션 하단"
                    />
                    <div className="compact-inline-editor portrait-image-inline">
                      <div className="compact-inline-head">
                        <span>이미지</span>
                        <button className="tiny-button" type="button" onClick={() => saveDbPortfolio()} disabled={dbLoading}>
                          {dbLoading ? '저장 중...' : '저장'}
                        </button>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => updateImageFile('hero', 'portraitImage', event.target.files?.[0])}
                      />
                      <CompactRowEditor
                        label="이미지 URL"
                        value={data.hero.portraitImage}
                        onChange={(value) => updateSection('hero', { portraitImage: value })}
                        placeholder="이미지 주소"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>


        <section className="section-interview section-grid reveal-up" id="about">
          <div className="section-heading about-panel">
            <p className="section-tag">{data.interview.tag}</p>
            {data.interview.questions.map((question, index) => (
              <div key={question.id}>
                <h2 className={`section-title${index > 0 ? ' small' : ''}`}>{question.title}</h2>
                <p className="section-copy">{question.answer}</p>
              </div>
            ))}
          </div>

          <div className="interview-portrait">
            {data.interview.portraitImage ? (
              <img className="interview-photo upload-photo" src={data.interview.portraitImage} alt={data.interview.portraitLabel} />
            ) : (
              <div className="interview-photo">{data.interview.portraitLabel}</div>
            )}
          </div>
        </section>

        <section className="section-grid section-career reveal-up" id="career">
          <div className="section-heading">
            <p className="section-tag">{data.career.tag}</p>
            <h2 className="section-title">{data.career.title}</h2>
            <p className="section-copy">{data.career.copy}</p>
          </div>

          <div className="career-stack">
            {data.career.items.map((item) => (
              <article className="career-card reveal-up" key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <ul>
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section-skills skill-stage" id="skill">
          <div className="skill-rail" aria-hidden="true">
            <span className="rail-dot" />
            <span className="rail-word">{data.skills.railWord}</span>
            <span className="rail-line" />
            <span className="rail-index">{data.skills.railIndex}</span>
          </div>

          <div className="skill-content">
            <div className="skill-marquee" aria-hidden="true">
              <span>{data.skills.marquee}</span>
              <span>{data.skills.marquee}</span>
            </div>

            <div className="skill-bottom-word" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={`${data.skills.bottomWord}-${index}`}>{data.skills.bottomWord}</span>
              ))}
            </div>

            {data.skills.groups.map((group, index) => (
              <div
                className={`skill-column ${SKILL_COLUMN_CLASSES[index]}`}
                key={group.id}
              >
                <div className={`skill-card ${SKILL_CARD_CLASSES[index]} reveal-up`}>
                  <h2>{group.title}</h2>
                  {group.items.map((item) => (
                    <div className="skill-row" key={item.id}>
                      <strong>{item.name}</strong>
                      <p>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section-projects" id="projects">
          <div className="projects-header reveal-up">
            <p className="section-tag">{data.projects.tag}</p>
            <h2 className="section-title">{data.projects.title}</h2>
          </div>

          <div className="project-list">
            {data.projects.items.map((project, index) => (
              <article className={`project-card reveal-up ${index % 2 === 0 ? 'from-right' : 'from-left'}`} key={project.id}>
                <div className="project-media">
                  <span className="project-media-tag">/</span>
                  {project.image ? <img className="project-image" src={project.image} alt={project.title} /> : <div className="project-image project-image-empty" aria-hidden="true" />}
                </div>
                <div className="project-content">
                  <p className="project-type">{project.type}</p>
                  <h3>{project.title}</h3>
                  <div className="project-details">
                    <div>
                      <span>기술</span>
                      <strong>{project.tech || '미지정'}</strong>
                    </div>
                    <div>
                      <span>언어</span>
                      <strong>{project.language || '미지정'}</strong>
                    </div>
                  </div>
                  <p className="project-overview">{project.overview || project.desc || '개요가 없습니다.'}</p>
                  <p className="project-purpose"><strong>목적</strong> {project.purpose || '포트폴리오 프로젝트 정리'}</p>
                  {project.repoUrl ? (
                    <a className="project-link" href={project.repoUrl} target="_blank" rel="noreferrer">
                      GitHub 바로가기
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="contact-panel reveal-up" id="contact">
          <div>
            <p className="section-tag">{data.contact.tag}</p>
            <h2 className="section-title">{data.contact.title}</h2>
            <p className="section-copy">{data.contact.copy}</p>
          </div>
          <div className="contact-links">
            {data.contact.buttons.map((button) => (
              <a className={`button ${button.variant === 'primary' ? 'primary' : 'secondary'}`} href={button.href} key={button.id}>
                {button.label}
              </a>
            ))}
            <a className="button secondary" href="#setting">
              설정 열기
            </a>
          </div>
        </section>
      </main>
    </div>
  )

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    window.__WHOMI_SAVE__ = saveDbPortfolio
    return () => {
      if (window.__WHOMI_SAVE__ === saveDbPortfolio) {
        delete window.__WHOMI_SAVE__
      }
    }
  }, [saveDbPortfolio])

  return mode === 'setting' ? (
    <>
      {renderPortfolioPage()}
      {renderSettingsPanel()}
    </>
  ) : (
    renderPortfolioPage()
  )
}

export default App
