
export const rgba = (r, g, b, a = 1) => {
  return {
    $IS_CSS_VAL: true,
    r, g, b, a,
    toString () {
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }
  }
}

export const Colors = {
  osxWinClose: rgba(251, 72, 72),
  osxWinMinimize: rgba(253, 178, 3),
  osxWinMaximize: rgba(41, 200, 51),
  primary: rgba(169, 19, 4),
  headBG: rgba(36, 36, 36),
  headFont: rgba(204, 204, 204),
  headTabHighlightBG: rgba(20, 20, 20),
  mainBG: rgba(240, 240, 240),
  font: rgba(20, 20, 20),
  fontInv: rgba(250, 250, 250),
  buttonPrimary: rgba(57, 141, 238)
}

