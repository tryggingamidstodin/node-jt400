package nodejt400;

import java.sql.Connection;
import java.util.Arrays;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.IFSFile;
import com.ibm.as400.access.IFSFileInputStream;

public class IfsReadStream {

	private ConnectionProvider connectionProvider;
	private final Connection connection;
	private int bufferSize = 10000;
	byte[] buffer = new byte[bufferSize];
	private final IFSFileInputStream fis;
	private boolean closed = false;

	public IfsReadStream(ConnectionProvider connectionProvider, String fileName)
			throws Exception {
		this.connectionProvider = connectionProvider;
		connection = connectionProvider.getConnection();
		IFSFileInputStream stream = null;
		try {
			AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
			AS400 as400 = handle.getSystem();
			IFSFile file = new IFSFile(as400, fileName);
			stream = new IFSFileInputStream(file);
		} catch (Exception e) {
			connectionProvider.returnConnection(connection);
			throw e;
		}
		fis = stream;
	}

	public synchronized void close() throws Exception {
		if (closed) {
			return;
		}
		closed = true;
		try {
			fis.close();
		} finally {
			connectionProvider.returnConnection(connection);
		}
	}

	public synchronized byte[] read() throws Exception {
		if (closed) {
			return null;
		}
		int n;
		try {
			n = fis.read(buffer);
		} catch (Exception e) {
			close();
			throw e;
		}
		if (n == -1) {
			close();
			return null;
		}
		return Arrays.copyOf(buffer, n);

	}
}
