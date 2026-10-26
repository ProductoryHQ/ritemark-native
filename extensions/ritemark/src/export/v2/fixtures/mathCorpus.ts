/**
 * Sprint 138 (#481), audit A4: the 40 formulas an analyst, a technical writer
 * or a trainer writes, as ChatGPT and Claude answers write them. The Word
 * spike ran every one through KaTeX's MathML, `mathml2omml` and docx; the Word
 * wrapper's test runs them again, so a converter upgrade that breaks one shows.
 *
 * `display` is how the formula usually appears: in a sentence or on its own line.
 */
export interface CorpusFormula {
  name: string
  latex: string
  display: boolean
}

export const MATH_CORPUS: CorpusFormula[] = [
  { name: 'mean', latex: '\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i', display: true },
  { name: 'x bar inline', latex: '\\bar{x}_1 = 3.1', display: false },
  { name: 'sample size', latex: 'n = 48', display: false },
  { name: 'standard deviation', latex: 's = \\sqrt{\\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2}', display: true },
  { name: 'variance', latex: '\\sigma^2 = \\mathbb{E}\\left[(X - \\mu)^2\\right]', display: true },
  { name: 'beta hat', latex: '\\hat{\\beta}', display: false },
  { name: 'regression', latex: 'y_i = \\beta_0 + \\beta_1 x_i + \\varepsilon_i', display: true },
  { name: 'OLS slope', latex: '\\hat{\\beta}_1 = \\frac{\\sum (x_i - \\bar{x})(y_i - \\bar{y})}{\\sum (x_i - \\bar{x})^2}', display: true },
  { name: 'compound growth', latex: 'A = P\\left(1 + \\frac{r}{n}\\right)^{nt}', display: true },
  { name: 'CAGR', latex: '\\text{CAGR} = \\left(\\frac{V_{\\text{end}}}{V_{\\text{start}}}\\right)^{1/t} - 1', display: true },
  { name: 'NPV', latex: '\\text{NPV} = \\sum_{t=0}^{T} \\frac{C_t}{(1+r)^t}', display: true },
  { name: 'elasticity', latex: '\\varepsilon = \\frac{\\Delta Q / Q}{\\Delta P / P}', display: true },
  { name: 'frac in sqrt', latex: '\\sqrt{\\frac{a^2 + b^2}{2}}', display: false },
  { name: 'cases', latex: 'f(x) = \\begin{cases} x^2 & \\text{if } x \\ge 0 \\\\ -x & \\text{otherwise} \\end{cases}', display: true },
  { name: 'pmatrix', latex: 'A = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', display: true },
  { name: 'aligned', latex: '\\begin{aligned} y &= 2x + 3 \\\\ &= 2(x + 1.5) \\end{aligned}', display: true },
  { name: 'limit', latex: '\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e', display: true },
  { name: 'max under', latex: '\\max_{x} f(x)', display: false },
  { name: 'absolute value', latex: '\\lvert x - \\mu \\rvert \\le 2\\sigma', display: false },
  { name: 'expectation', latex: '\\mathbb{E}[X] = \\sum_x x\\,p(x)', display: true },
  { name: 'text in math', latex: '\\text{margin} = 1.96\\,\\frac{s}{\\sqrt{n}}', display: true },
  { name: 'approx', latex: '\\pi \\approx 3.14159', display: false },
  { name: 'cdot', latex: 'a \\cdot b = \\lvert a \\rvert \\lvert b \\rvert \\cos\\theta', display: false },
  { name: 'percent', latex: '5\\%', display: false },
  { name: 'attrition', latex: 'A = \\frac{\\text{leavers}}{\\tfrac{1}{2}\\,(N_{\\text{start}} + N_{\\text{end}})} \\times 100\\%', display: true },
  { name: 'margin', latex: '\\Delta\\bar{x} \\pm 1.96\\,\\frac{s}{\\sqrt{n}} = 0.8 \\pm 0.21', display: true },
  { name: 'integral', latex: '\\int_0^1 x^2 \\, dx = \\frac{1}{3}', display: true },
  { name: 'normal pdf', latex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}', display: true },
  { name: 'z score', latex: 'z = \\frac{x - \\mu}{\\sigma}', display: false },
  { name: 'binomial', latex: '\\binom{n}{k} p^k (1-p)^{n-k}', display: true },
  { name: 'set builder', latex: '\\{x \\mid x > 0\\}', display: false },
  { name: 'subscript superscript', latex: 'x_{i}^{2}', display: false },
  { name: 'greek', latex: '\\alpha + \\beta = \\gamma', display: false },
  { name: 'inequality chain', latex: '0 \\le p \\le 1', display: false },
  { name: 'product', latex: '\\prod_{i=1}^{n} (1 + r_i) - 1', display: true },
  { name: 'derivative', latex: '\\frac{d}{dx} x^n = n x^{n-1}', display: true },
  { name: 'partial', latex: '\\frac{\\partial L}{\\partial \\theta}', display: false },
  { name: 'arrow', latex: 'x \\to \\infty', display: false },
  { name: 'confidence interval', latex: '\\bar{x} \\pm t_{\\alpha/2,\\,n-1} \\frac{s}{\\sqrt{n}}', display: true },
  { name: 'logistic', latex: 'p = \\frac{1}{1 + e^{-(\\beta_0 + \\beta_1 x)}}', display: true },
]
