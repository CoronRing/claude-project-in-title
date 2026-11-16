import type { EngineInterface, Register } from 'claude-code'

/** The desktop app's session tools: read this session's metadata, rename it. */
const GET_SESSION = 'mcp__ccd_session_mgmt__get_session'
const SET_TITLE = 'mcp__ccd_session_mgmt__set_session_title'

/** Folder segments that hold worktrees; the project is the folder above them. */
const WORKTREE_PARENTS = ['/.claude/worktrees/', '/.worktrees/']

/** The colour markers a tag can lead with, by the name the `colors` option uses. */
export const PALETTE: Readonly<Record<string, string>> = {
  purple: '🟣',
  blue: '🔵',
  green: '🟢',
  yellow: '🟡',
  orange: '🟠',
  red: '🔴',
  brown: '🟤',
  black: '⚫',
  white: '⚪',
}

/** What separates the tag from the session's own title. */
const SEPARATOR = '·'

/** The fields of the desktop app's session metadata this plugin reads. */
type SessionInfo = {
  title?: string
  cwd?: string
  originCwd?: string
}

/**
 * Returns the project name for a session folder: the folder's name, or the
 * repository's when the session runs in a worktree.
 *
 * @param folder the session's folder, absolute
 * @returns the project name, e.g. `my-app`
 */
export function projectName(folder: string): string {
  let path = folder.replace(/\\/g, '/').replace(/\/+$/, '')
  for (const parent of WORKTREE_PARENTS) {
    const at = path.indexOf(parent)
    if (at !== -1) path = path.slice(0, at)
  }
  return path.slice(path.lastIndexOf('/') + 1) || path
}

/**
 * Reads the `colors` option, `project=colour` pairs split by commas, into a
 * map from lower-cased project name to colour marker; unknown colours drop.
 *
 * @param spec the option's text, e.g. `my-app=purple, docs=green`
 * @returns the chosen marker per project
 */
export function parseColors(spec: string): Map<string, string> {
  const chosen = new Map<string, string>()
  for (const pair of spec.split(',')) {
    const [project, color] = pair.split('=').map(part => part.trim())
    const marker = color ? PALETTE[color.toLowerCase()] : undefined
    if (project && marker) chosen.set(project.toLowerCase(), marker)
  }
  return chosen
}

/**
 * Returns the project's colour marker: the one chosen for it, else one picked
 * from its name, so a project keeps its colour across sessions.
 *
 * @param project the project name
 * @param chosen the markers chosen in the `colors` option
 * @returns a colour marker from the palette
 */
export function colorFor(project: string, chosen: ReadonlyMap<string, string>): string {
  const picked = chosen.get(project.toLowerCase())
  if (picked) return picked
  const markers = Object.values(PALETTE)
  const lower = project.replace(/[A-Z]/g, letter => letter.toLowerCase())
  let hash = 0
  for (const byte of new TextEncoder().encode(lower)) hash = (hash * 31 + byte) % 4294967296
  return markers[hash % markers.length]!
}

/**
 * Returns `title` led by the project tag (`🟣 my-app · title`), unchanged when
 * it already is. An older tag for the same project, bracketed or with another
 * colour, is replaced.
 *
 * @param project the project name
 * @param marker the project's colour marker
 * @param title the title as it stands
 * @returns the tagged title
 */
export function withTag(project: string, marker: string, title: string): string {
  const tag = `${marker} ${project} ${SEPARATOR} `
  const trimmed = title.trim()
  if (trimmed.startsWith(tag)) return trimmed
  const name = project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const markers = Object.values(PALETTE).join('|')
  const stale = new RegExp(`^(?:(?:${markers})\\s*\\[?${name}\\]?|\\[${name}\\])\\s*(?:${SEPARATOR}\\s*)?`, 'u')
  return tag + trimmed.replace(stale, '')
}

/**
 * True when the desktop app's session tools are present: its sidebar ignores
 * titles set by hooks, so this module renames through the app instead.
 *
 * @param $ the engine interface
 * @returns whether the session runs in the desktop app
 */
async function isDesktop($: EngineInterface): Promise<boolean> {
  const tools = await $.tool.list()
  return tools.some(tool => tool.name === GET_SESSION)
}

/**
 * Tags a title for the session's project.
 *
 * @param $ the engine interface
 * @param chosen the markers chosen in the `colors` option
 * @param title the title as it stands, if the session has one
 * @returns the tagged title, or undefined when there is none or it is tagged
 */
async function retitle(
  $: EngineInterface,
  chosen: ReadonlyMap<string, string>,
  title: string | undefined,
): Promise<string | undefined> {
  if (!title) return undefined
  const project = projectName(await $.session.root())
  const tagged = withTag(project, colorFor(project, chosen), title)
  return tagged === title.trim() ? undefined : tagged
}

/**
 * Renames a desktop session through the app when its title lacks the tag.
 *
 * @param $ the engine interface
 * @param chosen the markers chosen in the `colors` option
 */
async function retitleDesktop($: EngineInterface, chosen: ReadonlyMap<string, string>): Promise<void> {
  const read = await $.tool.call({ tool: GET_SESSION, session_id: 'self' })
  if (read.deny !== undefined || read.isError || !read.text) return
  const info = JSON.parse(read.text) as SessionInfo
  const title = await retitle($, chosen, info.title)
  if (title) await $.tool.call({ tool: SET_TITLE, session_id: 'self', title })
}

/**
 * Renames the desktop app's sessions once a turn ends, after the app has named
 * the session. The terminal and VS Code are tagged by `hooks/title.sh`.
 */
export const register: Register = (on, options) => {
  const chosen = parseColors(typeof options.colors === 'string' ? options.colors : '')

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    try {
      if (await isDesktop($)) await retitleDesktop($, chosen)
    } catch (error) {
      $.ui.log(`${$.plugin.name}: could not tag the title: ${String(error)}`)
    }
    return result
  })
}
