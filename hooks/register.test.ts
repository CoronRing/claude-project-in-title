import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { colorFor, parseColors, projectName, withTag } from './register'

const ROOT = 'c:\\Users\\me\\code\\my-app'
const GET_SESSION = 'mcp__ccd_session_mgmt__get_session'
const SET_TITLE = 'mcp__ccd_session_mgmt__set_session_title'
const TAG = colorFor('my-app', new Map())

const TURN = { answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as const

/**
 * Stands in for the desktop app: lists its session tools (none when
 * `isDesktop` is false), answers the metadata read with `title`, and records
 * each rename.
 */
function fakeDesktop(on: On, title: string, renames: string[], isDesktop = true): void {
  const tools = isDesktop ? [{ name: GET_SESSION, description: '', mcp: true }] : []
  on('tool.list', () => ({ value: tools }))
  on('session.root', () => ({ value: ROOT }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', { tool: GET_SESSION }, () => ({
    result: {},
    text: JSON.stringify({ title, cwd: ROOT, originCwd: ROOT }),
  }))
  on('tool.call', { tool: SET_TITLE }, (_, e) => {
    renames.push(String((e as { title?: unknown }).title))
    return { result: {}, text: 'renamed' }
  })
}

test('the project is the folder, or the repository above a worktree', () => {
  expect(projectName(ROOT)).toBe('my-app')
  expect(projectName(`${ROOT}\\.claude\\worktrees\\fix-bug`)).toBe('my-app')
  expect(projectName('/home/me/core/.worktrees/feat')).toBe('core')
  expect(projectName('/home/me/toolbox/')).toBe('toolbox')
})

test('chosen colours win, others are stable picks from the palette', () => {
  const chosen = parseColors('my-app=Purple, docs = green, bad=pink, =red')
  expect(colorFor('MY-APP', chosen)).toBe('🟣')
  expect(colorFor('docs', chosen)).toBe('🟢')
  expect(chosen.size).toBe(2)
  expect(colorFor('toolbox', chosen)).toBe(colorFor('toolbox', new Map()))
})

test('a title is tagged once, and older tags are replaced', () => {
  expect(withTag('my-app', '🟣', 'Fix leak')).toBe('🟣 my-app · Fix leak')
  expect(withTag('my-app', '🟣', '🟣 my-app · Fix leak')).toBe('🟣 my-app · Fix leak')
  expect(withTag('my-app', '🟣', '[my-app] Fix leak')).toBe('🟣 my-app · Fix leak')
  expect(withTag('my-app', '🟣', '🔵 my-app · Fix leak')).toBe('🟣 my-app · Fix leak')
  expect(withTag('my-app', '🟣', 'my-app release notes')).toBe('🟣 my-app · my-app release notes')
})

test('desktop: a turn renames an untagged session through the app', async ($, on) => {
  const renames: string[] = []
  fakeDesktop(on, 'Observer fix', renames)

  await $.turn.complete(TURN)

  expect(renames).toEqual([`${TAG} my-app · Observer fix`])
})

test('desktop: a tagged session and a subagent turn are left alone', async ($, on) => {
  const renames: string[] = []
  fakeDesktop(on, `${TAG} my-app · Observer fix`, renames)

  await $.turn.complete(TURN)
  await $.turn.complete({ ...TURN, agentId: 'a1' })

  expect(renames).toEqual([])
})

test('a chosen colour reaches the title', { options: { colors: 'my-app=purple' } }, async ($, on) => {
  const renames: string[] = []
  fakeDesktop(on, 'Fix', renames)

  await $.turn.complete(TURN)

  expect(renames).toEqual(['🟣 my-app · Fix'])
})

test('outside the desktop app the module leaves titles to the shell hook', async ($, on) => {
  const renames: string[] = []
  fakeDesktop(on, 'Fix', renames, false)

  await $.turn.complete(TURN)

  expect(renames).toEqual([])
})

test('colour picks match hooks/title.sh', () => {
  expect(colorFor('my-app', new Map())).toBe('🟢')
  expect(colorFor('rc2', new Map())).toBe('🟢')
  expect(colorFor('DATE', new Map())).toBe('🟡')
})
