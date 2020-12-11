import {dscpCodesToOptions, ecnCodesToOptions} from '../lib/tos_helper'
import {expect} from 'chai'

describe('TosHelper', () => {
    // tslint:disable-next-line:completed-docs
    function checkSingleCodes(cases: [number, string[]][], codesToOption: (codes: number[]) => string[]) {
        for (const c of cases) {
            expect(codesToOption([c[0]])).to.deep.equal([c[0].toString(), ...c[1]])
        }
    }

    // tslint:disable-next-line:completed-docs
    function checkSingleTwoCodes(cases: [number, string[]][], codesToOption: (codes: number[]) => string[]) {
        for (let i = 0; i < cases.length - 1; i++) {
            const c1 = cases[i]
            const c2 = cases[i + 1]
            const set = new Set<string>()
            set.add(c1[0].toString())
            set.add(c2[0].toString())
            c1[1].forEach(s => set.add(s))
            c2[1].forEach(s => set.add(s))
            const expected = Array.from(set.values()).sort((s1, s2) => s1.localeCompare(s2))
            expect(codesToOption([c1[0], c2[0]])).to.deep.equal(expected)
        }
    }

    describe('dscp options', () => {
        const cases: [number, string[]][] = [
            [0, ['CS0', 'P0']],
            [1, ['LE']],
            [2, ['P0']],
            [3, []],
            [8, ['CS1', 'P1']],
            [9, []],
            [10, ['AF11', 'P1']],
            [11, []],
            [12, ['AF12', 'P1']],
            [14, ['AF13', 'P1']],
            [32, ['CS4', 'P4']],
            [34, ['AF41', 'P4']],
            [36, ['AF42', 'P4']],
            [38, ['AF43', 'P4']],
            [40, ['CS5', 'P5']],
            [42, ['P5']],
            [46, ['EF', 'P5']],
            [56, ['CS7', 'P7']],
        ]
        it('for single code', () => {
            checkSingleCodes(cases, dscpCodesToOptions)
        })
        it('for two codes', () => {
            checkSingleTwoCodes(cases, dscpCodesToOptions)
        })
    })
    describe('ecn options', () => {
        const cases: [number, string[]][] = [
            [0, []],
            [1, ['ECT']],
            [2, ['ECT']],
            [3, ['CE']],
        ]
        it('for single code', () => {
            checkSingleCodes(cases, ecnCodesToOptions)
        })
        it('for two codes', () => {
            checkSingleTwoCodes(cases, ecnCodesToOptions)
        })
    })
})
