package services

import (
	"crypto/x509"
	"fmt"
	"net"
	"syscall"
	"testing"
)

func TestClassifyConnectionError(t *testing.T) {
	cases := []struct {
		err  error
		want string
	}{
		{&net.DNSError{Err: "no such host", Name: "x"}, "dns_failed"},
		{fmt.Errorf("dial: %w", syscall.ECONNREFUSED), "connection_refused"},
		{&net.DNSError{Err: "timeout", IsTimeout: true}, "timeout"},
		{x509.UnknownAuthorityError{}, "tls_failed"},
		{fmt.Errorf("other"), "connection_failed"},
	}
	for _, tc := range cases {
		if got := classifyConnectionError(tc.err); got != tc.want {
			t.Errorf("%T: %s want %s", tc.err, got, tc.want)
		}
	}
}
