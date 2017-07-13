#!/usr/bin/env python3

import json
import sys
import threading
from enum import IntEnum
from subprocess import Popen, TimeoutExpired, DEVNULL
import argparse


# https://stackoverflow.com/questions/5179467/
def setInterval(interval, times=-1):
    # This will be the actual decorator,
    # with fixed interval and times parameter
    def outer_wrap(function):
        # This will be the function to be
        # called
        def wrap(*args, **kwargs):
            stop = threading.Event()

            # This is another function to be executed
            # in a different thread to simulate setInterval
            def inner_wrap():
                i = 0
                while i != times and not stop.isSet():
                    stop.wait(interval)
                    function(*args, **kwargs)
                    i += 1

            t = threading.Timer(0, inner_wrap)
            t.daemon = True
            t.start()
            return stop

        return wrap

    return outer_wrap


class State(IntEnum):
    DONE = 0
    WAIT = 1
    DL = 2


class Proc():
    def __init__(self, ep):
        self.name = ep['name']
        # self.m3u8 = ep['m3u8']
        self.state = State.WAIT
        self.cmd = Proc.makeCmd(ep['name'], ep['m3u8'])
        self.proc = None

    def Popen(self):
        self.state = State.DL
        self.proc = Popen(self.cmd, shell=True, stderr=DEVNULL)

    def poll(self):
        if self.proc:
            rv = self.proc.poll()
            # print(self.name, self.proc.pid, rv)
            if rv is not None:
                self.state = State.DONE
                self.proc.kill()
        return self.state

    def canPopen(self):
        return self.state is State.WAIT

    @staticmethod
    def makeCmd(name, m3u8):
        name += '.mp4'
        return "cvlc '{}' --sout='#duplicate{{dst=std{{access=file,mux=mp4,dst={}}}}}' vlc://quit".format(
            m3u8, name)


class ProcQ():
    def __init__(self, procs, timeout):
        self.procs = procs
        self.finished = []
        self.timeout = timeout

    def selectToPopen(self, N):
        r = []
        for p in self.procs:
            if p.canPopen():
                r.append(p)
            if len(r) >= N:
                break
        return r

    def Popen(self, N):
        r = self.selectToPopen(N)

        if len(r) == 0:
            return 0

        for p in r:
            p.Popen()

        for p in r:
            p.proc.wait(self.timeout)

    @setInterval(30)
    def poll(self):
        sa = [0, 0, 0]
        dls = []
        ds = []
        for p in self.procs:
            s = p.poll()
            if s is State.DONE:
                if p not in self.finished:
                    ds.append(p.name)
                    self.finished.append(p)
            elif s is State.DL:
            	dls.append(p.name)
            else:
                pass
            sa[s] += 1

        if len(ds) > 0:
        	print('\n')
        	for d in ds:
        		print(d, 'is done.')
        	print('downloading: {}, queuing: {}, done: {}'.format(sa[State.DL], sa[State.WAIT],
                                                  sa[State.DONE]))
        print(', '.join(dls), 'is downloading...', end='\r')

    def isAllDone(self):
        return len(self.procs) == len(self.finished)

    def cleanup(self):
        for p in self.procs:
            if p.state is not State.DONE and p.proc:
                p.state = State.WAIT
                p.proc.kill()


def main(args):
    playlist = json.load(open(args.json, encoding='utf-8-sig'))
    pq = ProcQ([Proc(ep) for ep in playlist], args.timeout)

    pq.poll()
    while not pq.isAllDone():
        try:
            if pq.Popen(args.maxprocess) == 0:
                break
        except TimeoutExpired:
            pq.cleanup()

    print('\nAll done >_0')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument(
        'json',
        help='The json file that you copy from m3u8 extractor userscript. e.g. m3u8.json')
    parser.add_argument(
        '-t',
        '--timeout',
        help=
        'Max time for video downloading, if over this, re-download.',
        default=1440,
        metavar='seconds',
        type=int)
    parser.add_argument(
        '-m',
        '--maxprocess',
        help=
        'Max processing number at the same time.',
        default=3,
        metavar='int',
        type=int)
    args = parser.parse_args()
    main(args)
