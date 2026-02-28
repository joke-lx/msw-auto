export class ResponseParser {
  parseMockResponse(response: string): any {
    try {
      // Try to extract JSON from code blocks
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }

      // Try to extract generic code blocks
      const codeMatch = response.match(/```\n([\s\S]*?)\n```/)

      if (codeMatch) {
        return JSON.parse(codeMatch[1])
      }

      // Try to parse entire response
      return JSON.parse(response)
    } catch (error: any) {
      // Try to extract JSON object from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch {
          throw new Error(`Failed to parse mock response: ${error.message}`)
        }
      }

      throw new Error('Invalid mock response format - no valid JSON found')
    }
  }

  parseMultipleMocks(response: string): any[] {
    try {
      const data = this.parseMockResponse(response)

      if (Array.isArray(data)) {
        return data
      }

      if (data.mocks && Array.isArray(data.mocks)) {
        return data.mocks
      }

      if (data.endpoints && Array.isArray(data.endpoints)) {
        return data.endpoints
      }

      throw new Error('Invalid multiple mocks response format')
    } catch (error: any) {
      throw new Error(`Failed to parse multiple mocks: ${error.message}`)
    }
  }

  parseCodeExamples(response: string, languages: string[]): Record<string, string> {
    try {
      const data = this.parseMockResponse(response)

      const examples: Record<string, string> = {}

      for (const lang of languages) {
        if (data[lang]) {
          examples[lang] = data[lang]
        }
      }

      if (Object.keys(examples).length === 0) {
        // Try to extract from code blocks
        languages.forEach((lang) => {
          const regex = new RegExp(`\`\`\`${lang}\\n([\\s\\S]*?)\\n\`\`\``, 'i')
          const match = response.match(regex)
          if (match) {
            examples[lang] = match[1]
          }
        })
      }

      return examples
    } catch (error: any) {
      throw new Error(`Failed to parse code examples: ${error.message}`)
    }
  }

  parseDocumentation(response: string): string {
    // Remove code block markers
    return response
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .trim()
  }
}
