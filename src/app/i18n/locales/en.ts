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
      source: '— {source}',
      /**
       * Only 86 of the catalogue's languages have a quote corpus, so this is a
       * permanent fact about a perfectly good language rather than an error:
       * `none` explains the disabled mode, `noneSwitched` reports the fallback
       * when the language changed under a quote run that was already chosen.
       */
      none: 'no quotes in {lang}',
      noneSwitched: 'no quotes in {lang} — switched to words'
    },
    restart: 'restart test',
    /** The `mods` chip: what it opens, and what is on behind it. */
    mods: {
      label: 'mods',
      active: '{count} on · ×{multiplier}'
    },
    setup: {
      loading: 'loading words…',
      dictionaryError: 'could not load the word list for {lang}',
      generationError: 'could not build a test from these settings',
      quoteEmpty: 'no {group} quotes in {lang} yet — try another length or language',
      quoteError: 'could not load a quote',
      retry: 'retry'
    },
    /**
     * What a group of mods affects — the registry's `slot`, used as the heading
     * of each icon-only mod group. Deliberately one word each: the group label
     * carries the distinction the icons cannot.
     */
    slot: {
      generation: 'text',
      core: 'rules',
      view: 'view'
    },
    /** Why a registry option is unavailable — rendered beside the disabled control. */
    constraint: {
      racing: 'locked during a race — exit the race to change settings',
      fixedText: 'fixed text — this mod would change nothing'
    }
  },
  /** The desktop build's own titlebar — never rendered in a browser. */
  window: {
    controls: 'window controls',
    minimize: 'minimize',
    maximize: 'maximize',
    restore: 'restore',
    close: 'close'
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
    captcha: {
      required: 'Complete the captcha to continue.',
      failed: 'Captcha check failed. Please try again.'
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
      toLogin: 'Go to login',
      resendDescription: 'Need a new link? Enter your email and we will send another.',
      resendSubmit: 'Resend verification email',
      resendSent: 'If that address still needs verifying, a new link is on its way.'
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
      restricted: 'account restricted',
      account: 'Account',
      logout: 'Log out'
    }
  },
  results: {
    signIn: 'sign in to save',
    saving: 'saving…',
    savedPending: 'saved · pending validation',
    notCountedRestricted: 'not counted — account restricted',
    saveFailed: "couldn't save",
    retry: 'retry',
    afk: 'afk {seconds}s',
    /** Same line with the share of the run window that was idle (afkMs / duration). */
    afkWithShare: 'afk {seconds}s · {percent}%',
    quoteBoard: 'this quote’s board',
    /** Hung under the grade and above it: the run's peak streak and its mods. */
    combo: '{combo}x combo',
    mods: 'mods ×{multiplier}',
    /** Icon-only actions: each label is both the tooltip and the accessible name. */
    nextTest: 'next test',
    watchReplay: 'watch replay',
    copyScreenshot: 'copy screenshot',
    screenshotCopied: 'screenshot copied to the clipboard',
    screenshotFailed: 'could not copy the screenshot'
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
    ping: { label: 'your ping', value: '{ms} ms' },
    create: 'Create room',
    joinByCode: 'Join by code',
    join: {
      title: 'Enter the code',
      placeholder: 'Code',
      hint: 'If you have a room code, enter it here to connect.',
      paste: 'Paste code',
      pasteFailed: 'could not read the clipboard',
      submit: 'join',
      invalid: 'Room codes are 6 characters',
      notFound: 'Room not found',
      full: 'That room is full'
    },
    /** Public room list — discovery beside create/join-by-code, not instead of it. */
    lobby: {
      title: 'Open rooms',
      loading: 'loading rooms…',
      error: 'Could not load the room list',
      retry: 'retry',
      empty: 'No open rooms right now',
      players: 'players {count}/{max}',
      time: '{seconds}s',
      words: '{count} words',
      inMatch: 'in match',
      /** Accessible name of a row: the whole row is one button. */
      joinRoom: 'Join {name}',
      /** Why a row cannot be clicked. Always rendered — never a dead row. */
      reason: {
        full: 'room is full',
        inMatch: 'match already started',
        offline: 'not connected'
      }
    }
  },
  room: {
    leaveFirst: "you're still in a room — leave it before going elsewhere",
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
    visibilityKind: { open: 'public', private: 'private' },
    /** The padlock's action, not its state — a tooltip says what a press does. */
    makeOpen: 'make the room public',
    makePrivate: 'make the room private',
    /** Cover over a private room's code until it is hovered or focused. */
    codeHidden: 'hover to reveal',
    mode: 'mode',
    duration: 'duration',
    wordCount: 'words',
    textMods: 'text mods',
    yourMods: 'your mods',
    viewMods: 'visual mods',
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
      /**
       * The idle meter. Just the state, no kick threat — the filling bar is
       * the whole message. Deliberately NOT the word "afk": the results
       * screen's `afkShare` is a different, post-hoc judging metric, and one
       * label on two numbers would read as a bug.
       */
      idle: {
        label: 'idle'
      },
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
          reload: 'your run ended when the page reloaded — the log did not survive it',
          idle: 'you went idle, so the seat handed its run in'
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
      /** Paired column, same as the solo stats row: net wpm accented, raw beside it. */
      wpmRaw: 'wpm / raw',
      acc: 'acc',
      /** correct/incorrect/extra/missed, in that order. */
      chars: 'chars',
      time: 'time',
      score: 'score',
      statusLabel: 'status',
      /**
       * The table is also rendered LIVE (an eliminated seat watching the rest of
       * the match), so it needs the racing statuses too — not only the three a
       * final standing can carry.
       */
      status: {
        finished: 'finished',
        eliminated: 'out',
        dnf: 'dnf',
        left: 'left',
        racing: 'racing',
        disconnected: 'disconnected',
        desynced: 'out of sync'
      },
      failReason: { master: 'master', expert: 'expert', minSpeed: 'min speed' },
      /** Server-measured idle share of a player's match window; explains an AFK dnf. */
      afkShare: 'afk {percent}%',
      reason: {
        deadline: 'match ended: time up',
        finishWindow: 'match ended: finish window closed'
      },
      you: 'you',
      reReady: 'ready for rematch',
      /** Keeps the seat — unlike `room.leave`, which gives it up. */
      backToLobby: 'back to lobby',
      connectionLost: 'connection lost — reconnecting…'
    },
    error: {
      title: 'match error',
      leave: 'back to servers'
    }
  },
  boards: {
    title: 'leaderboards',
    /** The rail: language / text source / variations, one active per group. */
    rail: {
      label: 'board filters',
      search: 'search languages…',
      source: 'text source',
      random: 'random',
      quotes: 'quotes',
      variations: 'board',
      /** The dimension is rendered under the name its mode gives it. */
      time: '{seconds}s',
      words: '{count} words',
      noLanguages: 'no language matches this search',
      noVariations: 'no boards have any entries yet',
      languageEmpty: 'no one has put a run on a board in this language yet'
    },
    /** A quote board: one per quote, reached through the picker or a link. */
    quote: {
      unknown: 'this quote could not be loaded',
      length: '{count} chars',
      pickerEmpty: 'no quotes match this filter',
      pickerError: 'could not load the quotes'
    },
    column: {
      rank: '#',
      player: 'player',
      score: 'score',
      wpm: 'wpm',
      raw: 'raw',
      acc: 'acc',
      when: 'when'
    },
    /** Row affordance — the whole row is the control, this is its accessible name. */
    watch: 'watch {player}’s run',
    race: 'race {player}’s run',
    /** The hover actions' visible titles. */
    actions: { watch: 'watch replay', race: 'race' },
    you: 'you',
    /** The pinned self row and its two hint states (204 / 401 from /me). */
    self: {
      top: 'Top {percent}%',
      play: 'play this mode to take a place here',
      signIn: 'sign in to see your place'
    },
    controls: {
      label: 'board controls',
      top: 'back to the top',
      me: 'jump to my row'
    },
    loading: 'loading the board…',
    empty: 'no one has set a time on this board yet',
    /** The catalogue itself is empty — no bucket anywhere has a visible entry. */
    noBoards: 'no boards have any entries yet',
    error: 'could not load the leaderboards',
    pageError: 'could not load this board',
    retry: 'retry',
    more: 'load more',
    moreAbove: 'load more above'
  },
  profile: {
    signin: {
      hint: 'sign in to see your typing statistics — tests, records, charts and the keyboard heatmap.',
      action: 'sign in'
    },
    sectionError: 'this section failed to load',
    retry: 'retry',
    joined: 'joined {date}',
    testsStarted: 'tests started',
    testsCompleted: 'tests completed',
    restartsPerCompleted: 'restarts per test',
    timeTyping: 'time typing',
    wordsTyped: 'words typed (est.)',
    metric: {
      wpm: 'wpm',
      raw: 'raw',
      acc: 'accuracy',
      consistency: 'consistency'
    },
    stat: {
      highest: 'highest',
      average: 'average',
      averageLast10: 'last 10'
    },
    activity: {
      title: 'activity',
      empty: 'no tests yet — the calendar fills in as you play.',
      aria: 'daily activity calendar for the last year',
      tooltip: '{tests} test | {tests} tests',
      streak: 'streak: {current} days (best {best})'
    },
    pbs: {
      title: 'personal bests',
      empty: 'no ranked results yet — finish a ranked-shape test to claim a board slot.',
      score: 'score',
      race: 'race',
      watch: 'watch',
      quote: 'quote'
    },
    charts: {
      title: 'progress',
      empty: 'nothing in this range yet.',
      histogramTitle: 'tests per 10 wpm',
      histogramAria: 'tests per 10 wpm bucket',
      dailyAria: 'daily time typing and average speed',
      tests: '{tests} test | {tests} tests',
      time: 'time typing',
      avgWpm: 'avg wpm',
      avgAcc: 'avg accuracy',
      trend: 'trend',
      range: 'range',
      metric: 'line metric',
      smoothing: 'smoothing',
      speed: 'speed',
      accuracy: 'accuracy',
      avgOf: 'avg of {n}',
      perHour: 'speed change per hour of typing: {delta} wpm',
      rangePreset: {
        all: 'all time',
        '3mo': '3 months',
        month: 'month',
        week: 'week',
        day: 'day'
      }
    },
    keyboard: {
      title: 'keyboard',
      layout: 'keyboard layout',
      metric: 'keyboard metric',
      accuracy: 'accuracy',
      speed: 'speed',
      aria: 'per-key heatmap',
      presses: '{n} presses',
      errors: '{p} errors',
      interval: '{ms} ms between keys',
      lowData: 'insufficient data',
      empty: 'no key data yet — accepted tests fill the heatmap in.'
    },
    runs: {
      title: 'tests',
      empty: 'no tests submitted yet.',
      when: 'when',
      mode: 'mode',
      lang: 'language',
      consistency: 'cons.',
      chars: 'chars',
      charsTitle: 'correct / incorrect / extra / missed',
      grade: 'grade',
      mods: 'mods',
      quote: 'quote',
      replay: 'watch',
      race: 'race',
      more: 'load more',
      loading: 'loading…',
      status: {
        pending: 'pending',
        accepted: 'accepted',
        flagged: 'in review',
        rejected: 'rejected'
      }
    }
  },
  race: {
    banner: 'racing {player} — {score}',
    exit: 'exit race',
    unranked: 'unranked — nothing is submitted',
    opponentFinished: 'finished',
    title: 'racing {player}',
    you: 'you',
    ghost: 'ghost',
    loading: 'loading the run…',
    /** Same deliberate vagueness as the replay page: the server's 404 covers
     * under-review, rejected, pending and banned-owner alike. */
    notFound: 'that run is not available',
    error: 'could not build this race',
    retry: 'retry',
    back: 'back to the board',
    won: 'you won',
    lost: 'the ghost won',
    score: '{you} wpm against {them} wpm',
    again: 'race again'
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
    quoteError: 'could not load the quote this run was played on',
    quoteMismatch: 'this quote’s text no longer matches the one this run was played on',
    buildError: 'could not rebuild this run',
    retry: 'retry',
    back: 'back to the board',
    by: 'by {player}'
  }
} as const
