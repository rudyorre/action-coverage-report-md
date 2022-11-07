import fs from 'fs/promises'
import path from 'path'
import {getReportParts} from './utils/getReportParts'
import {getStatus, statusHeader} from './utils/status'

export async function getMarkdownReport({
  pathToTextReport,
  ...restOptions
}: {
  pathToTextReport: string
  githubBaseUrl: string
  srcBasePath: string
}): Promise<string> {
  const textReport = await fs.readFile(pathToTextReport, {encoding: 'utf8'})
  return getMarkdownReportFromTextReport({textReport, ...restOptions})
}

export function getMarkdownReportFromTextReport({
  textReport,
  githubBaseUrl,
  srcBasePath
}: {
  textReport: string
  githubBaseUrl: string
  srcBasePath: string
}): string {
  const {coverageInfoHeader, coverageInfoRows} = getReportParts(textReport)

  let currentBasePath = path.relative('', srcBasePath)
  const modifiedInfoRows = coverageInfoRows.map(row => {
    const {updatedRow, basePath} = processRow(
      row,
      currentBasePath,
      githubBaseUrl
    )
    currentBasePath = basePath
    return updatedRow
  })

  const modifiedInfoHeader = addStatusColumn(coverageInfoHeader)

  return [modifiedInfoHeader.join('\n'), modifiedInfoRows.join('\n')].join('\n')
}

export function processRow(
  row: string,
  basePath: string,
  githubBaseUrl: string
): {basePath: string; updatedRow: string} {
  // 0: name | 1: statements | 2: branches | 3: functions | 4: lines | 5: uncovered lines
  const columns = row.split('|')

  const parsedNameColumn = columns[0].match(/^( *)(\S+)/)

  if (parsedNameColumn) {
    const [, leadingSpaces, fileName] = parsedNameColumn
    const mdLeadingSpaces = leadingSpaces.replaceAll(' ', '&nbsp;')
    const extension = path.extname(fileName)

    if (!extension) {
      basePath = fileName
      columns[0] = mdLeadingSpaces + fileName
    } else {
      const filePath = basePath ? `${basePath}/${fileName}` : fileName
      const fullFilePath = `${githubBaseUrl}/${filePath}`
      columns[0] = `${mdLeadingSpaces}[${fileName}](${fullFilePath})`
      columns[5] = formatUncoveredLines(columns[5], fullFilePath)
    }
  }
  const updatedRow = getStatus(parseFloat(columns[4])) + columns.join('|')
  return {
    basePath,
    updatedRow
  }
}

export function formatUncoveredLines(
  rawUncoveredLines: string,
  filePath: string
): string {
  const uncoveredLines = rawUncoveredLines.trim()

  if (uncoveredLines === '') {
    return ''
  }

  return uncoveredLines
    .split(',')
    .map(group => group.trim())
    .map(group => `[${group}](${filePath}#${group.replaceAll(/\d+/g, 'L$&')})`)
    .join(',')
}

function addStatusColumn(headerRows: string[]) {
  return headerRows.map((row, key) => {
    switch (key) {
      case 0:
        return statusHeader + row
      case 1:
        return `--|` + row
      case 2:
        // 0: name | 1: statements | 2: branches | 3: functions | 4: lines | 5: uncovered lines
        const columns = row.split('|')
        return getStatus(parseFloat(columns[4])) + row
    }
  })
}
