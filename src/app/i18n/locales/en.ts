/**
 * English — the source of truth. Every other locale mirrors these keys exactly;
 * a missing key falls back here (`fallbackLocale` in ./index.ts).
 */
export default {
  game: {
    mode: { words: 'words', time: 'time', quote: 'quote' },
    punctuation: 'punctuation',
    numbers: 'numbers',
    randomCase: 'random case',
    nospace: 'no space',
    blind: 'blind',
    reverse: 'reverse',
    fading: 'fading',
    flashlight: 'flashlight',
    minSpeed: 'min speed',
    minSpeedOff: 'off',
    language: 'language',
    difficulty: { label: 'difficulty', normal: 'normal', expert: 'expert', master: 'master' },
    quote: {
      length: 'length',
      group: { all: 'all', short: 'short', medium: 'medium', long: 'long', thicc: 'thicc' },
      source: '— {source}'
    },
    setup: {
      loading: 'loading words…',
      dictionaryError: 'could not load the word list for {lang}',
      generationError: 'could not build a test from these settings',
      quoteEmpty: 'no {group} quotes in {lang} yet — try another length or language',
      quoteError: 'could not load a quote',
      retry: 'retry'
    },
    /** Why a registry option is unavailable — rendered beside the disabled control. */
    constraint: {
      fixedText: 'fixed text — this mod would change nothing'
    }
  },
  picker: {
    search: 'search…',
    empty: 'nothing found',
    done: 'done',
    selected: '{count} selected',
    languageHint: 'Search and pick the language of the words you type.'
  },
  settings: {
    title: 'settings',
    search: 'search settings',
    empty: 'nothing matches “{query}”',
    category: {
      input: 'input',
      sound: 'sound',
      caret: 'caret',
      appearance: 'appearance',
      theme: 'theme',
      danger: 'danger zone'
    },
    value: {
      off: 'off',
      on: 'on'
    },
    uiLanguage: {
      label: 'interface language',
      description: 'Language of the interface. System follows your browser.',
      system: 'system'
    },
    reset: {
      label: 'reset settings',
      description: 'Restore every setting to its default. This cannot be undone.',
      action: 'reset',
      confirm: 'reset everything?',
      cancel: 'cancel',
      done: 'settings restored to defaults'
    },
    freedomMode: {
      label: 'freedom mode',
      description: 'Allows you to delete any word, even if it was typed correctly.'
    },
    stopOnError: {
      label: 'stop on error',
      description:
        'Letter mode will stop input when pressing any incorrect letters. Word mode will not allow you to continue to the next word until you correct all mistakes.',
      off: 'off',
      word: 'word',
      letter: 'letter'
    },
    quickEnd: {
      label: 'quick end',
      description:
        'This only applies to the words mode — when enabled, the test will end as soon as the last word has been typed, even if it is incorrect. When disabled, you need to manually confirm the last incorrect entry with a space.'
    },
    soundVolume: {
      label: 'sound volume',
      description: 'Change the volume of the sound effects.'
    },
    soundOnClick: {
      label: 'play sound on click',
      description: 'Plays a short sound when you press a key.'
    },
    smoothCaret: {
      label: 'smooth caret',
      description: 'The caret will move smoothly between letters and words.',
      slow: 'slow',
      medium: 'medium',
      fast: 'fast'
    },
    caretStyle: {
      label: 'caret style',
      description: 'Change the style of the caret during the test.',
      default: 'default',
      block: 'block',
      outline: 'outline',
      underline: 'underline'
    },
    background: {
      label: 'custom background',
      description:
        'Set an image url or a local image to be a custom background image. The local image always takes priority over the image url. Cover fits the image to cover the screen. Contain fits the image to be fully visible. Max fits the image corner to corner.',
      note: 'The local image is stored in your browser’s local storage and is never uploaded to the server — clearing that storage or switching browser loses it.',
      url: 'image url',
      urlPlaceholder: 'https://example.com/image.png',
      useLocal: 'use local image',
      localActive: 'local image in use',
      clear: 'clear',
      cover: 'cover',
      contain: 'contain',
      max: 'max',
      error: {
        not_an_image: 'That file is not an image.',
        too_large: 'That image is larger than {limit} — pick a smaller one.',
        read_failed: 'Could not read that file.',
        invalidUrl: 'Enter a direct link to an image file (.png, .jpg, .gif, .webp, .svg).'
      }
    },
    theme: {
      label: 'theme',
      description:
        'Completely change the look and feel of the website by picking one of the presets, or by creating your own completely custom theme.',
      open: 'browse themes'
    },
    colors: {
      label: 'custom colors',
      description: 'Tweak the active palette live. Copy exports it as theme JSON.',
      copy: 'copy',
      copied: 'theme copied to the clipboard',
      copyFailed: 'could not copy the theme'
    },
    fontSize: { label: 'font size', description: 'Size of the text during the test.' },
    fontFamily: { label: 'font family', description: 'Typeface used for the test text.' },
    showFps: { label: 'show fps', description: 'Show a frame-rate counter while typing.' },
    data: {
      label: 'settings file',
      description: 'Import or export all your settings as JSON.',
      export: 'export',
      import: 'import',
      imported: 'settings imported',
      importFailed: 'that file is not a valid settings export'
    },
    cookies: {
      label: 'cookie preferences',
      description: 'Review which cookies this site is allowed to store.',
      open: 'open'
    }
  },
  auth: {
    common: {
      email: 'Email',
      password: 'Password',
      displayName: 'Display name',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      or: 'or'
    },
    login: {
      title: 'Login',
      submit: 'Login',
      github: 'Continue with GitHub',
      google: 'Continue with Google',
      noAccount: 'No account?',
      createOne: 'Create one',
      forgotPassword: 'Forgot password?',
      failed: 'Invalid email or password.'
    },
    register: {
      title: 'Create account',
      submit: 'Create account',
      hasAccount: 'Have an account?',
      login: 'Log in',
      success: 'Account created. Check your email to verify your address.',
      nameTaken: 'That display name is already taken.',
      accountExists: 'An account with this email already exists.',
      failed: 'Could not create your account. Please try again.'
    },
    verify: {
      title: 'Verify email',
      pending: 'Verifying your email…',
      success: 'Your email is verified. You can now log in.',
      failed: 'This verification link is invalid or has expired.',
      missingToken: 'No verification token was provided.',
      toLogin: 'Go to login'
    },
    callback: {
      title: 'Signing you in',
      pending: 'Finishing sign-in…',
      failed: 'Sign-in could not be completed. Please try again.',
      toLogin: 'Back to login'
    },
    reset: {
      title: 'Reset password',
      description: 'Enter your email and we will send you a reset link.',
      submit: 'Send reset link',
      sent: 'If an account exists for that email, a reset link is on its way.',
      backToLogin: 'Back to login'
    },
    resetConfirm: {
      title: 'Set a new password',
      submit: 'Update password',
      success: 'Your password has been updated. You can now log in.',
      failed: 'This reset link is invalid or has expired.',
      missingToken: 'No reset token was provided.',
      toLogin: 'Go to login'
    },
    validation: {
      emailRequired: 'Email is required.',
      emailInvalid: 'Enter a valid email address.',
      passwordRequired: 'Password is required.',
      passwordMin: 'Password must be at least 8 characters.',
      passwordMax: 'Password must be at most 72 characters.',
      nameRequired: 'Display name is required.',
      nameLength: 'Display name must be 3–20 characters.',
      nameCharset: 'Only letters, numbers, and _ . - are allowed.'
    },
    header: {
      login: 'Login',
      account: 'Account',
      logout: 'Log out'
    }
  },
  results: {
    signIn: 'sign in to save',
    saving: 'saving…',
    savedPending: 'saved · pending validation',
    saveFailed: "couldn't save",
    retry: 'retry',
    afk: 'afk {seconds}s',
    /** Same line with the share of the run window that was idle (afkMs / duration). */
    afkWithShare: 'afk {seconds}s · {percent}%'
  },
  servers: {
    title: { lead: 'Welcome to', name: 'Servers' },
    status: {
      label: 'status',
      connecting: 'connecting…',
      connected: 'connected',
      reconnecting: 'reconnecting…',
      failed: 'connection failed',
      offline: 'offline'
    },
    create: 'Create room',
    joinByCode: 'Join by code',
    join: {
      title: 'Enter the code',
      placeholder: 'Code',
      hint: 'If you have a room code, enter it here to connect.',
      paste: 'Paste code',
      submit: 'join',
      invalid: 'Room codes are 6 characters',
      notFound: 'Room not found',
      full: 'That room is full'
    }
  },
  room: {
    code: 'room code',
    copy: 'copy room code',
    copied: 'copied!',
    players: 'players',
    guest: 'guest',
    host: 'host',
    readySeat: 'ready',
    kick: 'kick from room',
    makeHost: 'make host',
    settings: 'room settings',
    name: 'room name',
    visibility: 'visibility',
    visibilityKind: { open: 'open', private: 'private' },
    mode: 'mode',
    duration: 'duration',
    wordCount: 'words',
    textMods: 'text mods',
    yourMods: 'your mods',
    start: 'start game',
    ready: 'ready up',
    unready: 'cancel ready',
    isReady: 'you are ready',
    leave: 'leave room',
    gate: {
      needPlayers: 'waiting for at least one more player',
      notReady: 'waiting for everyone to ready up'
    },
    chat: {
      placeholder: 'Send a message',
      rateLimited: 'sending too fast — message dropped'
    },
    match: {
      go: 'go',
      opponents: 'opponents',
      waiting: {
        title: 'waiting for opponents…',
        racing: '{count} still racing'
      },
      eliminated: {
        title: "you're out",
        reason: {
          master: 'a wrong keystroke ended your run',
          expert: 'an errored word ended your run',
          minSpeed: 'you dropped below the net wpm floor',
          reload: 'your run ended when the page reloaded — the log did not survive it'
        },
        progress: 'progress',
        waiting: 'waiting for the others to finish'
      },
      status: {
        finished: 'finished',
        eliminated: 'out',
        disconnected: 'disconnected',
        dnf: 'dnf',
        desynced: 'out of sync',
        left: 'left'
      }
    },
    results: {
      title: 'results',
      player: 'player',
      mods: 'mods',
      wpm: 'wpm',
      acc: 'acc',
      time: 'time',
      score: 'score',
      statusLabel: 'status',
      status: { finished: 'finished', eliminated: 'out', dnf: 'dnf', left: 'left' },
      failReason: { master: 'master', expert: 'expert', minSpeed: 'min speed' },
      /** Server-measured idle share of a player's match window; explains an AFK dnf. */
      afkShare: 'afk {percent}%',
      reason: {
        deadline: 'match ended: time up',
        finishWindow: 'match ended: finish window closed'
      },
      you: 'you',
      reReady: 'ready for rematch',
      connectionLost: 'connection lost — reconnecting…'
    },
    error: {
      title: 'match error',
      leave: 'back to servers'
    }
  },
  boards: {
    title: 'leaderboards',
    /** Bucket picker. The dimension is rendered under the name its mode gives it. */
    bucket: {
      label: 'board',
      time: '{seconds}s · {lang}',
      words: '{count} words · {lang}',
      quote: 'quote · {id}',
      entries: '{count} entries'
    },
    column: { rank: '#', player: 'player', wpm: 'wpm', acc: 'acc', score: 'score', when: 'when' },
    /** Row affordance — the whole row is the control, this is its accessible name. */
    watch: 'watch {player}’s run',
    you: 'you',
    yourRank: 'your rank: #{rank}',
    /** 204 from /me: a real answer, not a failure. */
    notRanked: 'you hold no slot on this board yet',
    loading: 'loading the board…',
    empty: 'no one has set a time on this board yet',
    /** The catalogue itself is empty — no bucket anywhere has a visible entry. */
    noBoards: 'no boards have any entries yet',
    error: 'could not load the leaderboards',
    pageError: 'could not load this board',
    retry: 'retry',
    more: 'load more'
  },
  replay: {
    /** Stage 1 — the run's metadata. */
    loading: 'loading the run…',
    notFound: 'that run is not available',
    /**
     * Deliberately vague: the server answers 404 for a run that is under review,
     * rejected, still pending or owned by a banned player, precisely so a
     * spectator cannot tell those apart. The copy must not out-guess it.
     */
    notFoundHint: 'it may have been removed, or it may not be public.',
    /** Stage 2 — the event log, a SEPARATE request that can fail on its own. */
    logLoading: 'loading the keystrokes…',
    logError: 'could not load this run’s keystrokes',
    logErrorHint: 'the run itself loaded fine — only the replay data failed.',
    /** Stage 3 — the word list the run was played against, by content hash. */
    dictError: 'could not load the word list this run was played on',
    dictMismatch: 'this run’s word list no longer matches the published one',
    /** Regeneration from the seed produced nothing playable. */
    buildError: 'could not rebuild this run',
    retry: 'retry',
    back: 'back to the board',
    by: 'by {player}'
  }
} as const
