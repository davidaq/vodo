
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
  osxWinClose: rgba(200, 50, 50),
  osxWinOther: rgba(30, 140, 50),
  primary: rgba(169, 19, 4),
  headBG: rgba(36, 36, 36),
  headFont: rgba(204, 204, 204),
  font: rgba(20, 20, 20),
  fontInv: rgba(250, 250, 250),
}

