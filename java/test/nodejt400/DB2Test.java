package nodejt400;

import static org.junit.Assert.assertEquals;

import org.json.simple.JSONObject;
import org.junit.Test;

public class DB2Test
{

	@Test
	public void test()
	{
		DB2 db = DB2.getInstance("{\"user\": \"foo\"}");
		assertEquals("foo", db.getUser());

		JSONObject obj = new JSONObject();
		obj.put("user", "foo2");
		db = new DB2(obj);

		assertEquals("foo2", db.getUser());

	}

}
